import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import cursor from '../img/cursor.svg';
import cursorPointer from '../img/cursorPointer.svg';
import cursorClick from '../img/cursorClick.svg';

if(!THREE) throw new Error('THREE is not defined');

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}
const bloomParams = {
    bloomStrength: 1,
    bloomThreshold: .25,
    bloomRadius: .25
};
const speedCamera = {
    current: 1000,
    max: 1000,
    min: 0,
};

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const camera = new THREE.PerspectiveCamera( 75, sizes.width / sizes.height, 0.1, 1000 );
const controls = new OrbitControls( camera, renderer.domElement );
const mouse = new THREE.Vector2();

let unitList = [];
let lineList = [];
let selectedUnits = [];
let lastHovered;

let lastMove = Date.now();
window.addEventListener( 'mousemove', (e) => {
    lastMove = Date.now();

    mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
});
window.addEventListener('mousedown', (e) => {
    document.body.style.cursor = `url(${cursorClick}), pointer`;
});
window.addEventListener('mouseup', (e) => {
    document.body.style.cursor = `url(${cursorPointer}), pointer`;
});

window.addEventListener( 'resize', ()=>{
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize( sizes.width, sizes.height );
    renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
});

renderer.setSize( sizes.width, sizes.height );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setClearColor( 0x0000ff, .1);
document.body.appendChild( renderer.domElement );

fetch('http://localhost:1234/data/data.json').then(response => {
    return response.json();
}).then(json => {
    json.users.forEach(data => {
        generateUnit(data);
    });
});

document.addEventListener('click', (e) => {
    const mouse = new THREE.Vector2();
    mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( mouse, camera );

    const intersects = raycaster.intersectObjects( scene.children );
    if(intersects.length > 0) {
        const unit = intersects[0].object;
        if(!unit.isData || unit.flag) return;
        unit.flag = true;

        if ((selectedUnits.length < 2) && !selectedUnits.includes(unit)) {
            selectedUnits.push(unit);
            generateLinks(unit);

        } else if ((selectedUnits.length === 2) && !selectedUnits.includes(unit)) {
            removeLinks(selectedUnits[selectedUnits.length-1]);
            generateLinks(unit);
            selectedUnits.splice(-1);
            selectedUnits.push(unit);
            
        } else if (selectedUnits.includes(unit)) {
            removeLinks(unit);
            selectedUnits.splice(selectedUnits.indexOf(unit), 1);
        }
    }
    manageOpacity();
});

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const light = new THREE.PointLight(0xffffff, 0.5)
light.position.x = 2
light.position.y = 3
light.position.z = 4
scene.add(light);

const renderScene = new RenderPass( scene, camera );
const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
bloomPass.threshold = bloomParams.bloomThreshold;
bloomPass.strength = bloomParams.bloomStrength;
bloomPass.radius = bloomParams.bloomRadius;

const composer = new EffectComposer( renderer );
composer.addPass( renderScene );
composer.addPass( bloomPass );

let cos = 0;
const animate = function () {
    requestAnimationFrame(animate);

    manageMouseHover();

    if (Date.now() - lastMove > 2000) {
        if(speedCamera.current < speedCamera.max) speedCamera.current += 10;
    } else {
        if(speedCamera.current > speedCamera.min) speedCamera.current -= 20;
    }

    const speed = .1+Math.abs((speedCamera.current / 1000));
    cos += speed*.01;

    camera.position.x = Math.cos( cos ) * 40;
    camera.position.z = Math.sin( cos ) * 40;
    camera.position.y = Math.cos( cos ) * 15 + 5;
    
    lineList.forEach((e, i) => {
        e.forEach(line => {
            if ((line.actions.scale < 1) && !line.removeLine) {
                line.actions.scale += 0.02;
                scaleLine(line);
            } else if (line.removeLine) {
                if(line.actions.scale <= 0) {
                    scene.remove(line);
                    lineList[i].splice(lineList[i].indexOf(line), 1);
                    line.meshOrigin.flag = false;
                } else {
                    line.actions.scale -= 0.02;
                    scaleLine(line);
                }
            } else {
                line.meshOrigin.flag = false;
            }
            if (selectedUnits.length == 2) {
                line.material.opacity = .5;
            }
        });
    });

    // randomly rotate units
    unitList.forEach(unit => {
        if (unit.isData) {
            unit.rotation.x += (Math.random()*.02)-.01;
            unit.rotation.y += 0.01;
        }
    });

    camera.lookAt( scene.position );
    composer.render();
}
animate();

// ------------------------------//
//           Functions           //
// ------------------------------//

// Generate :
function generateUnit(data, color="#ADD8E6") {
    const geometry = new THREE.DodecahedronGeometry( 1, 0 );

    const material = new THREE.MeshStandardMaterial({
        color: color, 
        transparent: true
    });
    
    const mesh = new THREE.Mesh( geometry, material );
    mesh.material.side = THREE.BackSide;

    const limitX = (sizes.width - (sizes.width * .05)) / 20;
    const limitY = (sizes.height - (sizes.height * .05)) / 20;
    
    mesh.position.x = (Math.random() * limitX - limitX / 2) * Math.cos(Math.random() * 360);
    mesh.position.y = (Math.random() * limitY - limitY / 2) * Math.sin(Math.random() * 360);
    mesh.position.z = Math.random() * ((limitY + limitY) / 2) - ((limitY + limitY) / 4);

    for (let i = 0; i < unitList.length; i++) {
        if(checkCollision(mesh, unitList[i])) {
            return generateUnit(data, color);
        }
    }
    mesh.userData = data;
    mesh.isData = true;

    scene.add( mesh );
    unitList.push(mesh);
}
function generateLinks(mesh) {
    mesh.material.color.set(0x69bfdb);

    const userGroups = [mesh.userData.gender, mesh.userData.format, mesh.userData.platform];
    userGroups.forEach((group) => {
        const groupList = unitList.filter(e => Object.values(e.userData).includes(group));
        groupList.forEach(f => {
            buildLink(mesh, f, '#ffc9c9');
        })
    })
}
function buildLink(mesh1, mesh2, color="#ffc9c9") {
    lineList[mesh1.id] = lineList[mesh1.id] || [];
    if (lineList[mesh1.id].filter((e) => e.meshDestination.id === mesh2.id).length > 0) return;

    const geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
            mesh1.position,
            mesh2.position
        ]),
        64,
        0.05,
        8,
        false
    );
    let material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
    });

    const line = new THREE.Mesh(geometry, material);
    
    scene.add(line);
    line.actions = {
        scale: 0,
    };
    line.meshDestination = mesh2;
    line.meshOrigin = mesh1;
    line.removeLine = false;
    lineList[mesh1.id].push(line);
}

// Check :
function checkCollision(unit1, unit2) {
    const distance = unit1.position.distanceTo(unit2.position);
    if (distance < 2) {
        return true;
    } else {
        return false;
    }
}

// Actions : 
function scaleLine(line) {
    line.scale.set(line.actions.scale, line.actions.scale, line.actions.scale);
    line.position.set(
        line.meshOrigin.position.x * (1 - line.actions.scale),
        line.meshOrigin.position.y * (1 - line.actions.scale),
        line.meshOrigin.position.z * (1 - line.actions.scale)
    );
}
function removeLinks(mesh) {
    mesh.material.color.set(0xADD8E6);

    lineList[mesh.id].forEach(line => {
        line.removeLine = true;
    });
    mesh.flag = false;
}
function manageOpacity() {
    unitList.forEach(e => {
        if (selectedUnits.includes(e) || selectedUnits.length < 2) {
            e.material.opacity = 1;
        } else {
            e.material.opacity = .15;
        }
    });
}
function manageMouseHover() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( mouse, camera );

    const intersects = raycaster.intersectObjects( scene.children );
    if(intersects.length > 0) {
        const unit = intersects[0].object;
        if(!unit.isData || unit.flag) return;
        unit.material.color.set(0x69bfdb);
        document.body.style.cursor = `url(${cursorPointer}), pointer`;
        
        if(lastHovered && (lastHovered !== unit) && !selectedUnits.includes(lastHovered)) {
            lastHovered.material.color.set(0xADD8E6);
        }
        lastHovered = unit;
    } else {
        if(!selectedUnits.includes(lastHovered)) {
            lastHovered?.material.color.set(0xADD8E6);
        }
        document.body.style.cursor = `url(${cursor}), pointer`;
    }
}