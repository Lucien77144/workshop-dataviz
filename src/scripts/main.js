import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import cursor from '../img/cursor.svg';
import cursorPointer from '../img/cursorPointer.svg';
import bubble from '../img/bubble.svg';

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
const dataLabels = {
    age: 'Âge',
    gender: "Genre",
    format: "Format",
    platform: "Plateforme",
    alone: "Visionnage",
    day_watching: "Moment",
    artist: "Artiste",
    movie: "Film",
    character: "Personnage",
}

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const camera = new THREE.PerspectiveCamera( 75, sizes.width / sizes.height, 0.1, 1000 );
const mouse = new THREE.Vector2();

renderer.setSize( sizes.width, sizes.height );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setClearColor( 0x0000ff, .1);
const canvas = document.body.appendChild( renderer.domElement );

let userList = [];
let unitList = [];
let lineList = [];
let selectedUnits = [];
let lastHovered;
let isStatsActive;
let lastMove = Date.now();
let activeFilter;
let filtredValues;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.intro .btn-start')?.addEventListener('click', () => {
        document.querySelector('.intro').animate([
            {opacity: 1, transform: 'scale(1)'},
            {opacity: 0, transform: 'scale(1.2)'}
        ], {
            duration: 1000,
            easing: 'ease-in-out',
            fill: 'forwards'
        });
        setTimeout(() => {
            document.querySelector('.intro').remove();
            document.querySelector('.stats').classList.add('active');
        }, 1000);
    });

    document.querySelector('.btn-reset').addEventListener('click', (e) => {
        document.querySelector('.tag.active')?.classList.remove('active');
        activeFilter = undefined;
        buildInfosPanel(lastHovered.userData[activeFilter]);
        coloriseUnitFromFilter([]);
    });

    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            if (e.target.classList.contains('active')) {
                e.target.classList.remove('active');
                activeFilter = undefined;
                buildInfosPanel(lastHovered.userData[activeFilter]);
            } else {
                document.querySelector('.tag.active')?.classList.remove('active');
                e.target.classList.add('active');
                activeFilter = e.target.attributes['data-value'].value;

                if(lastHovered) {
                    buildInfosPanel(lastHovered.userData[activeFilter]);
                }
            }
        });
    })
});

window.addEventListener( 'mousemove', (e) => {
    isStatsActive = (e.path.filter(el => (el.classList?.contains('stats'))).length > 0)
    if (document.querySelector('.intro') || isStatsActive) return;
    lastMove = Date.now();

    mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
});
window.addEventListener( 'resize', ()=>{
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize( sizes.width, sizes.height );
    renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
});

fetch('http://localhost:1234/data/data.json').then(response => {
    return response.json();
}).then(json => {
    json.users.forEach(data => {
        generateUnit(data);
    });
    canvas.style.opacity = 1;

    userList = json.users;
    buildAges(getDiffAges(userList));
});

document.addEventListener('click', (e) => {
    isStatsActive = (e.path.filter(el => (el.classList?.contains('stats'))).length > 0)
    if (document.querySelector('.intro') || isStatsActive) return;
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
    coloriseUnitFromFilter(filtredValues);
    buildUserData();
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
    manageStats();

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
                line.material.opacity = .6;
            }
        });
    });

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
    mesh.material.color.set(0xffe484);

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
    if (document.querySelector('.intro') || isStatsActive) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( mouse, camera );

    const intersects = raycaster.intersectObjects( scene.children );
    if(intersects.length > 0) {
        const unit = intersects[0].object;
        if(!unit.isData || unit.flag) return;
        if (!unit.colorized) {
            unit.material.color.set(0xffe484);
        }
        document.body.style.cursor = `url(${cursorPointer}), pointer`;
        
        if(lastHovered && (lastHovered !== unit) && !selectedUnits.includes(lastHovered)) {
            if (!lastHovered.colorized) {
                lastHovered.material.color.set(0xADD8E6);
            }
        }
        lastHovered = unit;
        buildInfosPanel(lastHovered.userData[activeFilter]);
    } else {
        if(!selectedUnits.includes(lastHovered)) {
            if (!lastHovered?.colorized) {
                lastHovered?.material.color.set(0xADD8E6);
            }
        }
        document.body.style.cursor = `url(${cursor}), pointer`;
    }
}
function manageStats() {
    const menu1 = document.querySelector('.menu1');
    const menu2 = document.querySelector('.menu2');

    if (selectedUnits?.length > 0) {
        if(menu1.classList.contains('active')) {
            menu1.classList.remove('active');
            menu1.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(150%)' }
            ], {
                duration: 500,
                easing: 'ease-in-out',
            });
            setTimeout(() => {
                menu1.style.display = 'none';
                menu2.style.display = 'block';
                menu2.classList.add('active');
                menu2.animate([
                    { transform: 'translateX(150%)' },
                    { transform: 'translateX(0)' }
                ], {
                    duration: 500,
                    easing: 'ease-in-out',
                });
            }, 500);
        }
    } else {
        if (menu2.classList.contains('active')) {
            menu2.classList.remove('active');
            menu2.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(150%)' }
            ], {
                duration: 500,
                easing: 'ease-in-out',
            });
            setTimeout(() => {
                menu2.style.display = 'none';
                menu1.style.display = 'block';
                menu1.classList.add('active');
                menu1.animate([
                    { transform: 'translateX(150%)' },
                    { transform: 'translateX(0)' }
                ], {
                    duration: 500,
                    easing: 'ease-in-out',
                });
            }, 500);
        }
    }
}
function coloriseUnitFromFilter(values) {
    if (unitList?.length === values?.length) return;
    if (selectedUnits.length > 0) {
        return unitList.forEach(e => {
            e.colorized = false;
            if ((lastHovered != e) && !selectedUnits.includes(e)) {
                e.material.color.set(0xADD8E6);
            }
        });
    };

    unitList.forEach(e => {
        e.colorized = false;
        e.material.color.set(0xADD8E6);
        if(values.includes(e.userData)) {
            e.colorized = true;
            e.material.color.set(0xffe484);
        }
    });
}
function buildInfosPanel(values) {
    filtredValues = userList.filter(user => user[activeFilter] === values);
    buildInfos(values, filtredValues.length);
    buildAges(getDiffAges(filtredValues), filtredValues);
    buildCircles(filtredValues);
    coloriseUnitFromFilter(filtredValues);
}
function buildAges(data, filtredList = userList) {
    let htmlResult = '';
    data.forEach((e) => {
        const frequency = filtredList.filter((user) => user.age === e).length;
        htmlResult += `
        <li class="unit">
            <div class="label">${e} ans</div>
            <div class="progress">
                <div class="value" style="width: ${frequency/filtredList.length*100}%;"></div>
                <div class="bubble">
                    <img src="${bubble}" alt="">
                    <span>${frequency}</span>
                </div>
            </div>
        </li>`;
    });
    document.querySelector('.ages').innerHTML = htmlResult;
}
function buildInfos(gender='Aucun filtre', number=0) {
    document.querySelector('.section-infos .gender .field').innerHTML = gender;
    document.querySelector('.section-infos .number .field').innerHTML = number;
}
function buildCircles(filtredValues = userList) {
    const maxCircleSize = 125;

    const alone = filtredValues.filter(e => e.alone).length;
    const total = filtredValues.length;

    const sizeAlone = alone/total;
    const sizeMany = (total-alone)/total;

    document.querySelector('.section-infos .viewing .circle.alone').style.width = `${maxCircleSize*sizeAlone}px`;
    document.querySelector('.section-infos .viewing .circle.alone').style.height = `${maxCircleSize*sizeAlone}px`;

    document.querySelector('.section-infos .viewing .circle.many').style.width = `${maxCircleSize*sizeMany}px`;
    document.querySelector('.section-infos .viewing .circle.many').style.height = `${maxCircleSize*sizeMany}px`;

    
    document.querySelector('.section-infos .viewing .circle.alone').innerHTML = alone;
    document.querySelector('.section-infos .viewing .circle.many').innerHTML = total-alone;

}
function buildUserData() {
    const data1 = selectedUnits[0]?.userData;
    const data2 = selectedUnits[1]?.userData;

    document.querySelector(".stats .menu2 .data1 .field").innerHTML = buildLines(data1);
    document.querySelector(".stats .menu2 .data2 .field").innerHTML = buildLines(data2);
}
function buildLines(data) {
    if (data) {
        result = '';
        data.alone = data.alone ? 'Seul' : 'Accompagné';
        data.day_watching = data.day_watching ? 'En journée' : 'En soirée';
        for (const [key, value] of Object.entries(data)) {
            if (!value) break;
            const filtredData = filterData(data, key);
            result += `<div class="field-item">
                <p class='label'>${dataLabels[key]}</p>
                <div class='values'>
                    <p class='value'>${value}</p>
                    <p class='pin counter'>${filtredData?.length ? filtredData.length : 1}</p>
                </div>
            </div>`;
        }
        return result;
    } else {
        return '<p class="field-empty">Selectionnez une donnée</p>';
    }
}

// get data : 
function getDiffAges(users) {
    return users.map(user => user.age).filter((age, index, self) => self.indexOf(age) === index);
}
function filterData(user, filter) {
    return userList.filter(e => e[filter] === user[filter]);
}