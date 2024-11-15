/*
This script handles characters: instantiation, transforms, n all that.
*/

const characterLayer = document.getElementById("layer-character");

let characters = {};

function deleteCharacter(id) {
    if (characters[id] !== undefined) {
        characters[id].element.dispose();
        characters[id].wrapper.remove();
        delete characters[id];
    }
}

function createCharacter(id, spineVer = 4.1, defaultAnimation = 'idle', x = 0, y = 0, isDownloaded, customPath = null) {
    deleteCharacter(id);

    characters[id] = {
        id: id,
        name: 'Unnamed',

        spineObject: null, // instantiated player
        wrapper: null, // html element
        player: null, // spine player object

        emotion: defaultAnimation,
        initialAnimation: defaultAnimation,
        emotions: [],
        talking: false,
        loaded: false,

        skins: [],

        transforms: {
            x: x,
            y: y,
            rotate: 0,
            scale: 1,
            opacity: 1
        },

        // 0 to 1 (inclusive)
        anchorPoint: {
            x: 0.5,
            y: 0.5
        }
    }

    let runSpineVer;

    if (spineVer == 4.0) {
        runSpineVer = spine40
    } else if (spineVer == 4.1) {
        runSpineVer = spine41
    }

    const immut = id;
    const immut2 = defaultAnimation;

    const path = customPath ?? '';

    let config = {
        skelUrl: path + ".skel",
        atlasUrl: path + ".atlas",
        alpha: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        showControls: false,
        showLoading: false,
        defaultMix: 0,
        viewport: {
            transitionTime: 0
        },
        success: function (player) {
            player.play();
            player.playAnimationWithTrack(0, immut2, true);
            characters[immut].player = player;

            characters[immut].emotions = [];
            player.animationState.data.skeletonData.animations.forEach((e) => {
                if (!e.name.startsWith("talk_")) {
                    characters[immut].emotions.push(e.name);
                }
            });

            characters[immut].skins = [];
            player.animationState.data.skeletonData.skins.forEach((e) => {
                characters[immut].skins.push(e.name);
            });

            console.log("CHARACTER " + immut + " LOADED!");
            characters[immut].loaded = true;
        }
    }

    const div = document.createElement("div");
    div.id = "character-" + id;
    div.classList.add("character-spine")
    div.style.top = `${y}px`;
    div.style.left = `${x}px`;
    div.style.opacity = "1";
    div.style.position = "absolute";

    characterLayer.appendChild(div);

    characters[id].wrapper = div;
    characters[id].spineObject = new runSpineVer.SpinePlayer("character-" + id, config);
    
}

function characterLoop(elapsed) {
    // update character transforms
    for (const id in characters) {
        const character = characters[id];

        character.wrapper.style.left = `${character.transforms.x}px`;
        character.wrapper.style.top = `${character.transforms.y}px`;
        character.wrapper.style.opacity = `${character.transforms.opacity}`;

        character.wrapper.style.transform = `translateX(-${character.anchorPoint.x * 100}%) translateY(-${character.anchorPoint.y * 100}%) rotate(${character.transforms.rotate}deg)`
        character.spineObject.zoomMultiplier = 1 / character.transforms.scale;
    }
}