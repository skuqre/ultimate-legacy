/*
This script handles dialogue playback and editor logic.
*/

const { Tween, Easing } = require("@tweenjs/tween.js");
const { webUtils, ipcRenderer } = require('electron');
const path = require("node:path");
const prompt = require("electron-prompt");
const fuzzysort = require("fuzzysort");

var inEditor = true;
var hasLoaded = false;

const dialogueMain = document.getElementById("dialogue-main");
const editorMain = document.getElementById("editor-main");

const psb = new FontFace('Pretendard-SemiBold', "url('../assets/fonts/Pretendard-SemiBold.ttf')");
await psb.load();
document.fonts.add(psb);

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

const sfxType = new Audio("../assets/sounds/dialogue_type.wav");

const sfxChoiceEnter = new Audio("../assets/sounds/choice_enter.wav");
const sfxChoiceSelect = new Audio("../assets/sounds/choice_select.wav");
const sfxChoiceError = new Audio("../assets/sounds/choice_error.wav");

var curBgmPlaying = new Audio();
var curSfxPlaying = new Audio();
var curVoPlaying = new Audio();

var canBgmPlay = true;
var canSfxPlay = true;
var canVoPlay = true;
var curBgmKey = null;
var curSfxKey = null;
var curVoKey = null;

var scnName = "New False Memory";
var camera = {
    initX: 1920 * 0.5,
    initY: 1080 * 0.5,
    initZ: 1.0,
    initR: 0,
    x: 0,
    y: 0,
    z: 1.0,
    r: 0
}
var bg = {
    initLink: "CommanderRoom",
    initX: 1920 * 0.5,
    initY: 1080 * 0.5,
    initS: 0.6,
    initR: 0,
    link: "",
    x: 0,
    y: 0,
    s: 1.0,
    r: 0
}

var loadedBgs = {
    "CommanderRoom": "../assets/images/CommanderRoom.png"
}

var loadedBgm = {}
var loadedSfx = {}
var loadedVo = {}

var curColorDefinitions = {}
var curCharacters = [];
var curScenario = [];
var curDialogue = 0;

var curScenarioHidden = false;
var curScenarioAuto = false;
var curScenarioLogOpen = false;
var curScenarioShown = true; // delayed

var curDialogueSpeaker = "";
var curDialogueContent = [];
var curDialogueChoices = [];
var curDialogueChoiceElements = [];
var curDialogueState = "narration";

var curDialoguePlaying = false;
var curDialogueMaxTime = 0.0;
var curDialogueCurTime = 0.0;

var dialogueColorBar = document.getElementById("dialogue-deco-color-bar");
var dialogueSpeakerText = document.getElementById("dialogue-text-speaker");
var dialogueContentText = document.getElementById("dialogue-text-content");
var dialogueNarrationBox = document.getElementById("dialogue-element-narrationbox");
var dialogueNarrationText = document.querySelector("div#dialogue-element-narrationbox > span");
var dialogueChoiceList = document.getElementById("dialogue-container-choices");

var dialogueFader = document.getElementById("layer-fader");
var dialogueDarkener = document.getElementById("layer-darkener");

var dialogueDecoPointer = document.getElementById("dialogue-deco-pointer");
var dialogueDecoMesh = document.getElementById("dialogue-deco-mesh");

var dialogueContainerSpeech = document.getElementById("dialogue-container-speech");
var dialogueContainerChoice = document.getElementById("dialogue-container-choices");
var dialogueContainerNarration = document.getElementById("dialogue-container-narration");
var dialogueGradientChoice = document.getElementById("gdc");
var dialogueGradientSpeech = document.getElementById("gds");

var layerDialogue = document.getElementById("layer-dialogue");
var layerControls = document.getElementById("layer-controls");

var layerWorld = document.getElementById("layer-world");
var layerBackground = document.getElementById("layer-background");
var layerCharacter = document.getElementById("layer-character");

const backgroundMain = document.getElementById("background-main");

var skipping = false;

function parseDialogue(noTalk = false) {
    if ((curDialogue > curScenario.length - 1 && curScenario.length > 0) || skipping) {
        transitionStinger();

        if (curScenarioHidden) {
            controlHide.onclick();
        }

        if (curScenarioAuto) {
            controlAuto.onclick();
        }

        inEditor = true;
        canProgress = true;
        curDialogue = curSelectedEntry;

        curBgmKey = null;
        curSfxKey = null;
        curVoKey = null;
        curBgmPlaying.pause();
        curSfxPlaying.pause();
        curVoPlaying.pause();
        
        setTimeout(() => {
            dialogueMain.classList.add("edit-mode");
            editorMain.style.display = null;
            selectDialogueEntry(curSelectedEntry);
        }, 40 * 20);

        return;
    }
    
    if (curDialogue === 0) {
        initPositions();
    }

    if (curScenario.length === 0) {
        initPositions();
        return;
    }

    const entry = curScenario[curDialogue];
    curDialogueState = entry.type.toLowerCase();

    dialogueContainerSpeech.style.opacity = "0";
    dialogueContainerChoice.style.opacity = "0";
    dialogueContainerNarration.style.opacity = "0";
    dialogueGradientChoice.style.opacity = "0";
    dialogueGradientSpeech.style.opacity = "0";

    dialogueDecoPointer.style.opacity = "0";
    dialogueDecoPointer.style.animation = "unset";

    dialogueFader.style.backgroundColor = "rgba(0, 0, 0, 0)";
    dialogueDarkener.style.display = "none";

    if (dialogueDecoPointer.classList.contains("narration")) {
        dialogueDecoPointer.classList.remove("narration");
    }

    while (dialogueChoiceList.firstChild) {
        dialogueChoiceList.removeChild(dialogueChoiceList.lastChild);
    }

    curDialogueChoiceElements = [];

    // end all tweens
    for (const i of tweens) {
        i.end();
    }
    // these three lines shall exclaim "I give up", as the tweening system is so ass

    // end only SFX and VO since BGM is persistent across entries
    curSfxPlaying.pause();
    curVoPlaying.pause();

    switch (curDialogueState) {
        case "speech":
            dialogueContainerSpeech.style.opacity = "1";
            dialogueGradientSpeech.style.opacity = "1";

            dialogueSpeakerText.innerHTML = entry.speaker;

            // set color
            let color = "#ffffff";

            if (entry.speaker in curColorDefinitions) {
                color = curColorDefinitions[entry.speaker];
            }
            dialogueColorBar.style.backgroundColor = color;
            dialogueColorBar.style.boxShadow = color + "80 0 0 3px";

            // set text
            setText(entry.content);

            if (entry.speakerModel !== null && entry.speakerModel.trim().length > 0) {
                if (!(entry.speakerModel in characters)) return;

                const characterModel = characters[entry.speakerModel];

                // move model to the top most layer by removing then appending
                const characterElement = characterModel.wrapper;
                characterLayer.removeChild(characterElement);
                characterLayer.appendChild(characterElement);

                // make model size up like the game does for some reason???
                /*
                const characterWrappers = [...document.getElementsByClassName("character-spine")];
                for (const i of characterWrappers) {
                    i.style.setProperty("--scale-num", "1.0");
                }
                const scaleTween = new Tween({scale: 1})
                    .to({scale: 1.005}, 1000) // debatable
                    .easing(Easing.Sinusoidal.InOut)
                    .onUpdate((e) => {
                        characterElement.style.setProperty("--scale-num", `${e.scale}`);
                    })
                    .start();
                tweens.push(scaleTween);
                */

                if (!noTalk) {
                    if (characterModel.emotion !== entry.speakerModelEmotion && entry.speakerModelEmotion) {
                        characterModel.player.playAnimationWithTrack(0, entry.speakerModelEmotion, true);
                        characterModel.emotion = entry.speakerModelEmotion;
                    }

                    if (entry.speakerModelPlayAnim) {
                        characterModel.player.playAnimationWithTrack(1, entry.speakerModelPlayAnim, true);

                        if (!(entry.speakerModelLoopAnim ?? false)) {
                            characterModel.player.queueNextEmpty(1, 4/60);
                        }
                    }

                    characterModel.player.playAnimationWithTrack(2, "talk_start", true);
                    characterModel.talking = true;
                }
            }
        
            curDialogueCurTime = 0.0;
            curDialoguePlaying = true;

            break;
        case "choice":
            dialogueContainerChoice.style.opacity = "1";
            dialogueGradientChoice.style.opacity = "1";

            if (!inEditor && entry.choices.length > 0) {
                sfxChoiceEnter.play();
            }

            curDialogueChoices = [];

            for (let i = 0; i < entry.choices.length; i++) {
                const choice = entry.choices[i];
                addChoice(choice.text, choice.style, choice.jump);
            }

            setTimeout(() => {
                for (let i = 0; i < curDialogueChoiceElements.length; i++) {
                    const choice = curDialogueChoiceElements[i];
                    choice.style.opacity = "1";
                    setTimeout(() => {
                        choice.style.pointerEvents = "all";
                    }, 250);
                }

                // curDialogueCurTime = 0.0;
                // if (curScenario[curDialogue].time != null) {
                //     curDialogueMaxTime = curScenario[curDialogue].time;
                // } else {
                //     curDialogueMaxTime = 0.0;
                // }

                // curDialoguePlaying = true;
            }, 100)

            break;
        case "monologue":
        case "narration":
            dialogueContainerNarration.style.opacity = "1";
            dialogueGradientChoice.style.opacity = "1";

            if (curDialogueState === "monologue") {
                dialogueNarrationBox.style.color = "#ffffff";
            } else if (curDialogueState === "narration") {
                dialogueNarrationBox.style.color = "#d6d6d6";
            }

            setText(entry.content);

            curDialogueCurTime = 0.0;
            curDialoguePlaying = true;

            dialogueDecoPointer.classList.add("narration");

            break;
    }

    if (entry.focusX || entry.focusY || entry.focusZ || entry.focusR) {
        const tween = new Tween(camera)
            .to({
                x: entry.focusX ? entry.focusPosX : camera.x,
                y: entry.focusY ? entry.focusPosY : camera.y,
                z: entry.focusZ ? entry.focusZoom : camera.z,
                r: entry.focusR ? entry.focusRot : camera.r,
            }, (entry.focusDur !== null ? entry.focusDur : 1) * 1000)
            .easing(Easing[entry.focusEaseType][entry.focusEaseDir])
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (entry.fadeIn && !inEditor) {
        const tween = new Tween({perc: 0})
            .to({
                perc: 1
            }, (entry.fadeInDur !== null ? entry.fadeInDur : 1) * 1000)
            .easing(Easing.Sinusoidal.InOut)
            .onUpdate((n) => {
                dialogueFader.style.backgroundColor = `rgba(0, 0, 0, ${1 - n.perc})`
            })
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (entry.fadeToBlack && !inEditor) {
        const tween = new Tween({perc: 0})
            .to({
                perc: 1
            }, (entry.fadeBlackDur !== null ? entry.fadeBlackDur : 1) * 1000)
            .easing(Easing.Sinusoidal.InOut)
            .onUpdate((n) => {
                dialogueFader.style.backgroundColor = `rgba(0, 0, 0, ${n.perc})`
            })
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (entry.bg.fade) {
        const tween = new Tween({perc: 0})
            .to({
                perc: 1
            }, (entry.bg.fadeDur !== null ? entry.bg.fadeDur : 1) * 1000)
            .easing(Easing.Sinusoidal.InOut)
            .onUpdate((n) => {
                backgroundMain.style.opacity = n.perc;
            })
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (entry.bg.key !== null) {
        bg.link = entry.bg.key;
    }

    if (entry.bg.change.x || entry.bg.change.y || entry.bg.change.s || entry.bg.change.r) {
        const tween = new Tween(bg)
            .to({
                x: entry.bg.change.x ? entry.bg.change.changeX : bg.x,
                y: entry.bg.change.y ? entry.bg.change.changeY : bg.y,
                s: entry.bg.change.s ? entry.bg.change.changeS : bg.s,
                r: entry.bg.change.r ? entry.bg.change.changeR : bg.r,
            }, (entry.bg.change.changeDur !== null ? entry.bg.change.changeDur : 1) * 1000)
            .easing(Easing[entry.bg.change.changeEase][entry.bg.change.changeEaseDir])
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (entry.bgm.key !== null && (!inEditor || canBgmPlay) && curBgmKey !== entry.bgm.key) {
        curBgmKey = entry.bgm.key;
        curBgmPlaying.pause();

        curBgmPlaying.src = loadedBgm[entry.bgm.key];
        curBgmPlaying.loop = true;
        curBgmPlaying.load();
        curBgmPlaying.play();
        
        if (entry.bgm.fade) {
            const tween = new Tween({perc: 0})
                .to({
                    perc: 1
                }, (entry.bgm.fadeDur !== null ? entry.bgm.fadeDur : 1) * 1000)
                .easing(Easing.Sinusoidal.InOut)
                .onUpdate((n) => {
                    curBgmPlaying.volume = n.perc * entry.bgm.volume;
                })
                .onComplete(() => {
                    tweens.splice(tweens.indexOf(tween), 1);
                })
                .start();
            tweens.push(tween);
        } else {
            curBgmPlaying.volume = entry.bgm.volume;
        }
    }

    if (entry.sfx.key !== null && (!inEditor || canSfxPlay) && curSfxKey !== entry.sfx.key) {
        curSfxKey = entry.sfx.key;
        curSfxPlaying.pause();

        curSfxPlaying.src = loadedSfx[entry.sfx.key];
        curSfxPlaying.loop = false;
        curSfxPlaying.volume = entry.sfx.volume;
        curSfxPlaying.load();
        curSfxPlaying.play();
    }

    if (entry.vo.key !== null && (!inEditor || canVoPlay) && curVoKey !== entry.vo.key) {
        curVoKey = entry.vo.key;
        curVoPlaying.pause();

        curVoPlaying.src = loadedVo[entry.vo.key];
        curVoPlaying.loop = false;
        curVoPlaying.volume = entry.vo.volume;
        curVoPlaying.load();
        curVoPlaying.play();
    }

    if (entry.stopBgm) {
        const volCapture = curBgmPlaying.volume;
        const tween = new Tween({perc: 0})
            .to({
                perc: 1
            }, (entry.stopBgmDur !== null ? entry.stopBgmDur : 1) * 1000)
            .easing(Easing.Sinusoidal.InOut)
            .onUpdate((n) => {
                curBgmPlaying.volume = (1 - n.perc) * volCapture;
            })
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (entry.stopSfx) {
        const volCapture = curSfxPlaying.volume;
        const tween = new Tween({perc: 0})
            .to({
                perc: 1
            }, (entry.stopSfxDur !== null ? entry.stopSfxDur : 1) * 1000)
            .easing(Easing.Sinusoidal.InOut)
            .onUpdate((n) => {
                curSfxPlaying.volume = (1 - n.perc) * volCapture;
            })
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (entry.stopVo) {
        const volCapture = curVoPlaying.volume;
        const tween = new Tween({perc: 0})
            .to({
                perc: 1
            }, (entry.stopVoDur !== null ? entry.stopVoDur : 1) * 1000)
            .easing(Easing.Sinusoidal.InOut)
            .onUpdate((n) => {
                curVoPlaying.volume = (1 - n.perc) * volCapture;
            })
            .onComplete(() => {
                tweens.splice(tweens.indexOf(tween), 1);
            })
            .start();
        tweens.push(tween);
    }

    if (!(!entry.keyframeDuration || entry.keyframeDuration <= 0)) {
        curDialogueMaxTime = entry.keyframeDuration;
    }
}

// Controls
const controlHide = document.getElementById("button-hide-hitbox");
const controlAuto = document.getElementById("button-auto-hitbox");
const controlLog = document.getElementById("button-log-hitbox");
const controlSkip = document.getElementById("button-skip-hitbox");

for (const c of [controlHide, controlAuto, controlLog, controlSkip]) {
    c.onmousedown = (e) => {
        controlCommonPress(c.parentElement);
    }

    c.onmouseup = (e) => {
        controlCommonRelease(c.parentElement);
    }

    c.onmouseleave = (e) => {
        controlCommonRelease(c.parentElement);
    }
}

controlHide.onclick = (e) => {
    if (inEditor) return;
    curScenarioHidden = !curScenarioHidden;

    if (curScenarioHidden) {
        layerDialogue.style.opacity = "0";
        layerControls.style.opacity = "0";

        dialogueGradientChoice.style.opacity = "1";
        dialogueGradientSpeech.style.opacity = "0";

        curScenarioShown = false;
    } else {
        layerDialogue.style.opacity = "1";
        layerControls.style.opacity = "1";

        if (curScenario[curDialogue]) {
            switch (curScenario[curDialogue].type) {
                case "Speech":
                    dialogueGradientSpeech.style.opacity = "1";
                    break;
                case "Monologue":
                case "Narration":
                case "Choice":
                    dialogueGradientChoice.style.opacity = "1";
                    break
            }
        } else {
            dialogueGradientChoice.style.opacity = "1";
        }

        setTimeout(() => {
            curScenarioShown = true;
        }, 250);
    }
}

controlAuto.onclick = () => {
    if (inEditor) return;

    curScenarioAuto = !curScenarioAuto;

    const buttonAuto = document.getElementById("control-button-auto");

    buttonAuto.classList.remove("active")
    if (curScenarioAuto) {
        buttonAuto.classList.add("active")
    }

    if (autoTimer !== null) {
        clearTimeout(autoTimer);
        autoTimer = null;
    }
}

controlSkip.onclick = () => {
    if (inEditor) return;

    skipping = true;
    parseDialogue(true);

    skipping = false;
}

function controlCommonPress(parentElement) {
    parentElement.style.scale = "0.95";
    parentElement.style.filter = "brightness(40%)";
}

function controlCommonRelease(parentElement) {
    parentElement.style.scale = "1";
    parentElement.style.filter = "brightness(100%)";
}

window.addEventListener("click", (e) => {
    if (inEditor) return;
    if (curScenarioHidden && !mouseOver("button-hide-hitbox", e)) {
        controlHide.onclick();
    }
});

/**
 * To replicate the typewriter effect the game has, each letter is placed in a `span` element.
 * You can easily create these arrays of spans by using this function.
 * Does not work when the dialogue state is "choice".
 * @param { String } text 
 */
function setText(text) {
    const split = text.trim().split("");
    curDialogueContent = [];

    while (dialogueContentText.firstChild) {
        dialogueContentText.removeChild(dialogueContentText.lastChild);
    }

    while (dialogueNarrationText.firstChild) {
        dialogueNarrationText.removeChild(dialogueNarrationText.lastChild);
    }

    for (let i = 0; i < split.length; i++) {
        let letter = split[i];
        let addTo = null;

        switch (curDialogueState) {
            case "speech":
                addTo = dialogueContentText;

                // offset by line amount
                var lines = contentMeasureText(text).length;
                dialogueContainerSpeech.style.transform = `translateY(${-39 * Math.max(lines - 2, 0)}px)`;
                dialogueGradientSpeech.style.height = `${322 + 39 * Math.max(lines - 2, 0)}px`;

                break;
            case "choice":
                console.log("[INFO] setText cannot be used for Choice-type entries!")
                return;
            case "monologue":
            case "narration":
                addTo = dialogueNarrationText;

                var lines = narrationMeasureText(text).length;
                if (lines > 2) {
                    dialogueNarrationBox.classList.remove("oneline");
                } else {
                    dialogueNarrationBox.classList.add("oneline");
                }

                break;
        }

        const span = document.createElement("span");
        span.innerHTML = letter;
        span.style.opacity = "0";
        addTo.appendChild(span);

        if (letter != " " && letter != "\n") {
            curDialogueContent.push(span);
        }
        if (letter === "\n") {
            addTo.appendChild(document.createElement("br"));
        }
    }

    curDialogueMaxTime = calcLength(text);
}

let prev = 0;

function updateText() {
    const lettersToDisplay = clamp(Math.floor(curDialogueCurTime / (4/60)), 0, curDialogueContent.length);

    if (prev !== lettersToDisplay && !["narration", "monologue", "choice"].includes(curDialogueState) && !inEditor) {
        sfxType.play();
    }

    for (let i = 0; i < curDialogueContent.length; i++) {
        curDialogueContent[i].style.opacity = "0";
    }

    for (let i = 0; i < lettersToDisplay; i++) {
        curDialogueContent[i].style.opacity = "1";
    }

    prev = lettersToDisplay
}

/**
 * Adds a choice.
 * @param { String } choice 
 * @param { Int } jumpTo 
 */
function addChoice(choice = "", style = null, jumpTo = null) {
    curDialogueChoices.push({
        text: choice,
        style: style,
        jump: jumpTo
    });

    updateChoices();
}

function updateChoices() {
    while (dialogueChoiceList.firstChild) {
        dialogueChoiceList.removeChild(dialogueChoiceList.lastChild);
    }

    curDialogueChoiceElements = [];

    for (let i = 0; i < curDialogueChoices.length; i++) {
        const choice = curDialogueChoices[i];
        const measure = choiceMeasureText(choice.text);
        const isOneline = measure.length === 1;

        const main = document.createElement("div");
        main.classList.add("choice");
        main.style.opacity = "0";
        main.style.pointerEvents = "none";
        if (isOneline) {
            main.classList.add("oneline");
        }
        if (choice.style !== null) {
            main.classList.add(choice.style);
        }

        const keybind = document.createElement("div");
        keybind.classList.add("keybind-display");
        keybind.innerHTML = choiceKeybinds.charAt(i).toUpperCase();

        const deco1 = document.createElement("div");
        deco1.classList.add("choice-deco");

        const mesh1 = document.createElement("img");
        mesh1.src = "../assets/images/choice_mesh.png";
        mesh1.classList.add("mesh-left");
        mesh1.draggable = false;
        deco1.appendChild(mesh1);

        const mesh2 = document.createElement("img");
        mesh2.src = "../assets/images/choice_mesh.png";
        mesh2.classList.add("mesh-right");
        mesh2.draggable = false;
        deco1.appendChild(mesh2);

        const deco2 = document.createElement("div");
        deco2.classList.add("choice-deco");
        deco2.id = "choice-deco-tri"

        const tri1 = document.createElement("img");
        tri1.src = "../assets/images/choice_tri_glow.png";
        tri1.classList.add("tri-left");
        tri1.draggable = false;
        deco2.appendChild(tri1);

        const tri2 = document.createElement("img");
        tri2.src = "../assets/images/choice_tri_glow.png";
        tri2.classList.add("tri-right");
        tri2.draggable = false;
        deco2.appendChild(tri2);

        const deco3 = document.createElement("div");
        deco3.classList.add("choice-deco");
        deco3.id = "choice-deco-glow"

        const glow = document.createElement("div");
        glow.classList.add("choice-glow");
        glow.classList.add("choice-press-items");
        deco3.appendChild(glow);

        const pressMeshes = deco1.cloneNode(true);
        pressMeshes.classList.add("mesh-pressed")
        pressMeshes.classList.add("choice-press-items");

        main.appendChild(deco1);
        main.appendChild(deco2);
        main.appendChild(deco3);
        main.appendChild(pressMeshes);
        main.appendChild(pressMeshes.cloneNode());
        main.appendChild(pressMeshes.cloneNode());

        const span = document.createElement("span");
        span.innerHTML = choice.text.replaceAll("\n", "<br>");

        main.appendChild(span);

        if (choiceKeybinds.charAt(i).trim() !== "") {
            main.appendChild(keybind);
        }

        main.onmousedown = (e) => {
            choiceCommonPress(span.parentElement); // ???
        }

        main.onmouseup = (e) => {
            choiceCommonRelease(span.parentElement);

            main.setAttribute("active", true);

            sfxChoiceSelect.play();

            setTimeout(() => {
                curDialogueChoiceElements = [];
                parseChoice(choice);
            }, 300);

            curDialogueChoiceElements.forEach((e) => {
                if (e.style.scale !== "1.2")
                {
                    e.style.transition = "opacity 0.1666666667s linear";
                    e.style.opacity = "0";
                    e.style.pointerEvents = "none";
                }
            });
        }

        main.onmouseleave = (e) => {
            choiceCommonLeave(span.parentElement);
        }

        dialogueChoiceList.appendChild(main);
        curDialogueChoiceElements.push(main);
    }

    if (curDialogueChoices.length > 1) {
        dialogueDarkener.style.display = "block";
    } else {
        dialogueDarkener.style.display = "none";
    }
}

function choiceCommonPress(element) {
    element.style.transition = "scale 0.05s linear";
    element.style.scale = "0.95";

    const triLeft = element.querySelector(".tri-left");
    const triRight = element.querySelector(".tri-right");
    triLeft.style.transition = "left 0.05s linear";
    triRight.style.transition = "right 0.05s linear";

    triLeft.style.left = "22px";
    triRight.style.right = "22px";

    const items = element.getElementsByClassName("choice-press-items");
    [...items].forEach((e) => {
        e.style.transition = "opacity 0.05s linear";
        e.style.opacity = "1";
    });
}

function choiceCommonRelease(element) {
    element.style.transition = "scale 0.3s linear, opacity 0.3s linear";
    element.style.scale = "1.2";
    element.style.opacity = "0";

    const item = element.querySelector("#choice-deco-glow > div");
    item.style.transition = "scale 0.3s linear, opacity 0.3s linear";
    item.style.scale = "1.5";
    item.style.opacity = "0";

    element.style.pointerEvents = "none";
}

function choiceCommonLeave(element) {
    if (element.style.scale !== "1.2") {
        element.style.transition = "scale 0.05s cubic-bezier(0.61, 1, 0.88, 1)";
        element.style.scale = "1";

        const triLeft = element.querySelector(".tri-left");
        const triRight = element.querySelector(".tri-right");
        triLeft.style.transition = "left 0.05s cubic-bezier(0.61, 1, 0.88, 1)";
        triRight.style.transition = "right 0.05s cubic-bezier(0.61, 1, 0.88, 1)";

        triLeft.style.left = "-3px";
        triRight.style.right = "-3px";

        const items = element.getElementsByClassName("choice-press-items");
        [...items].forEach((e) => {
            e.style.transition = "opacity 0.05s cubic-bezier(0.61, 1, 0.88, 1)";
            e.style.opacity = "0";
        });
    }
}

function parseChoice(entry) {
    curDialogueCurTime = curDialogueMaxTime;
    curDialoguePlaying = false;

    if (entry.jump !== null) {
        if (entry.jump >= 0 && entry.jump <= curScenario.length - 1) {
            curDialogue = entry.jump;
        } else {
            console.log("[ERROR] Choice jump index out of scenario index bounds");
        }
    } else {
        curDialogue++;
    }

    parseDialogue();
}

/**
 * Measure text with choice styles. Used to differentiate single line choices and multiline choices.
 * @param { String } text 
 */
function choiceMeasureText(text) {
    ctx.font = "21px Pretendard-SemiBold";
    ctx.letterSpacing = "0.3px";
    return getLinesForParagraphs(ctx, text, 454);
}

function contentMeasureText(text) {
    ctx.font = "23px Pretendard-SemiBold";
    ctx.letterSpacing = "0.24px";
    return getLinesForParagraphs(ctx, text, 1080 - 250);
}

function narrationMeasureText(text) {
    ctx.font = "23px Pretendard-SemiBold";
    ctx.letterSpacing = "0.2px";
    return getLinesForParagraphs(ctx, text, 534 - 32);
}

/**
 * wtf does this do
 */

let canProgress = true;
function skipOrProgress() {
    if (!hasLoaded) return;
    if (!canProgress) return;

    if (curDialogueCurTime < curDialogueMaxTime) {
        if (curDialoguePlaying) {
            curDialogueCurTime = curDialogueMaxTime;

            // stop all talking models
            for (const i of Object.keys(characters)) {
                if (!characters[i].talking) continue;
                characters[i].player.playAnimationWithTrack(2, "talk_end", false);
                characters[i].player.queueNextEmpty(2, 4/60);
                characters[i].player.animationState.setEmptyAnimation(2, 4/60);
                characters[i].talking = false;
            }

            // end all tweens
            // that would finish before the dialogue is done
            for (const i of tweens) {
                if (i.getDuration() / 1000 <= curDialogueMaxTime) {
                    i.end();
                }
            }
        }
    } else if (tweens.length > 0) {
        // end all tweens
        for (const i of tweens) {
            i.end();
        }
    } else {
        const entry = curScenario[curDialogue];

        if (curScenario[curDialogue] && entry.fadeOut && !inEditor) {
            const tween = new Tween({perc: 0})
                .to({
                    perc: 1
                }, (entry.fadeOutDur !== null ? entry.fadeOutDur : 1) * 1000)
                .easing(Easing.Sinusoidal.InOut)
                .onUpdate((n) => {
                    dialogueFader.style.backgroundColor = `rgba(0, 0, 0, ${n.perc})`
                })
                .onComplete(() => {
                    tweens.splice(tweens.indexOf(tween), 1);

                    if (entry.jump !== null) {
                        if (entry.jump >= 0 && entry.jump <= curScenario.length - 1) {
                            curDialogue = entry.jump;
                        } else {
                            console.log("[ERROR] Jump index out of scenario index bounds");
                        }
                    } else {
                        curDialogue++;
                    }

                    parseDialogue();
                })
                .start();
            tweens.push(tween);
        } else {
            if (entry.jump !== null) {
                if (entry.jump >= 0 && entry.jump <= curScenario.length - 1) {
                    curDialogue = entry.jump;
                } else {
                    console.log("[ERROR] Jump index out of scenario index bounds");
                }
            } else {
                curDialogue++;
            }

            parseDialogue();
        }
    }
}

let autoTimer = null;

/**
 * Main update loop function
 * @param { Float } elapsed 
 */
function dialogueLoop(elapsed) {
    if (curDialoguePlaying) {
        if (curDialogueCurTime < curDialogueMaxTime) {
            curDialogueCurTime += elapsed;
            updateText();
            updateTimelinePosition();

            if (curScenario[curDialogue].type === "Speech" ||
                curScenario[curDialogue].type === "Narration" ||
                curScenario[curDialogue].type === "Monologue") {
                dialogueDecoPointer.style.opacity = "0";
                dialogueDecoPointer.style.animation = "unset";
            }
        } else {
            curDialogueCurTime = curDialogueMaxTime;
            curDialoguePlaying = false;
            updateText();
            updateTimelinePosition();

            if (curScenario[curDialogue].type === "Speech" ||
                curScenario[curDialogue].type === "Narration" ||
                curScenario[curDialogue].type === "Monologue") {
                dialogueDecoPointer.style.opacity = "1";
                dialogueDecoPointer.style.animation = "0.8s infinite pointer cubic-bezier(0.37, 0, 0.63, 1)";
            }
        }

        if (curDialogueCurTime >= calcLength(curScenario[curDialogue].content)) {
            if (curScenario[curDialogue].type === "Speech") {
                if (curScenario[curDialogue].speakerModel !== null) {
                    if (!(curScenario[curDialogue].speakerModel in characters)) return;
                    if (!characters[curScenario[curDialogue].speakerModel].talking) return;

                    characters[curScenario[curDialogue].speakerModel].player.playAnimationWithTrack(2, "talk_end", false);
                    characters[curScenario[curDialogue].speakerModel].player.queueNextEmpty(2, 4/60);
                    characters[curScenario[curDialogue].speakerModel].talking = false;
                }
            }
        }
    }

    if (curScenario.length > 0 && !inEditor && curScenarioAuto) {
        if (curScenario[curDialogue].type !== "Choice") {
            const conditionsToBeDone = [
                curDialogueCurTime >= curDialogueMaxTime,
                tweens.length === 0,
                curSfxPlaying.played.length > 0 ? curSfxPlaying.ended : true,
                curVoPlaying.played.length > 0 ? curVoPlaying.ended : true,
            ];
        
            if (!conditionsToBeDone.includes(false)) {
                if (autoTimer === null) {
                    autoTimer = setTimeout(() => {
                        skipOrProgress();
                        autoTimer = null;
                    }, 1500);
                }
            }
        } else {
            if (curDialogueChoiceElements.length === 1) {
                if (autoTimer === null && curDialogueChoiceElements[0].getAttribute("active") === null) {
                    autoTimer = setTimeout(() => {
                        curDialogueChoiceElements[0].onmousedown();
                        setTimeout(() => {
                            curDialogueChoiceElements[0].onmouseup();
                            autoTimer = null;
                        }, 100)
                    }, 1500);
                }
            } else {
                autoTimer = null;
            }
        }
    }
}

/**
 * camera update
 */

var curBgLink = "";
function cameraLoop(elapsed) {
    layerBackground.style.transform = `
    translateX(${(bg.x + ((bg.x - camera.x) * 0.1))}px)
    translateY(${(bg.y + ((bg.y - camera.y) * 0.1))}px)
    scale(${bg.s})
    rotate(${bg.r}deg)
    `;

    if (curBgLink !== bg.link) {
        curBgLink = bg.link;
        backgroundMain.src = loadedBgs[curBgLink];
    }

    layerCharacter.style.transform = `
    translateX(${((1920 * 0.5 - camera.x))}px)
    translateY(${((1080 * 0.5 - camera.y))}px)
    `

    layerWorld.style.transform = `
    rotate(${camera.r}deg)
    scale(${camera.z})
    `
}

const loadingScreen = document.getElementById("loading-screen");
const loadingText = document.getElementById("loading-text");

let fromImport = false;

/**
 * Init
 */
function init() {
    loadingScreen.style.display = "";

    const charactersToLoad = [...curCharacters];

    let charsLoaded = Object.values(characters).filter(a => a.loaded);

    const loadInterval = setInterval(() => {
        charsLoaded = Object.values(characters).filter(a => a.loaded);
        loadingText.innerHTML = `Loading characters... (${charsLoaded.length}/${curCharacters.length})`;

        const i = charactersToLoad[0];
        if (charactersToLoad[0]) {
            if (!characters[i.id]) {
                createCharacter(i.id, i.ver, i.initAnimation, i.initTransforms.x, i.initTransforms.y, null, i.customPath);
            } else {
                if (characters[i.id].loaded) {
                    charactersToLoad.shift();
                    initPositions();
                    characterLoop(0);
                }
            }
        }

        if (charsLoaded.length === curCharacters.length) {
            parseDialogue();

            if (inEditor) {
                updateDialogueList();
                selectDialogueEntry(0);

                updateCharacterList();
                selectCharacterEntry(null);
            }

            // initPositions();

            hasLoaded = true;
            loadingScreen.style.display = "none";

            clearInterval(loadInterval);

            if (fromImport) {
                popUpError("File loaded!");
                fromImport = false;
            }
        }
    }, 1)
}

/**
 * despite what the name says, this just initializes everything initial about the character
 */
function initPositions() {
    camera.x = camera.initX;
    camera.y = camera.initY;
    camera.z = camera.initZ;
    camera.r = camera.initR;

    bg.link = bg.initLink;
    bg.x = bg.initX;
    bg.y = bg.initY;
    bg.s = bg.initS;
    bg.r = bg.initR;

    // initialize character positions
    for (const i of curCharacters) {
        if (!characters[i.id]) continue;
        characters[i.id].transforms.x = i.initTransforms.x;
        characters[i.id].transforms.y = i.initTransforms.y;
        characters[i.id].transforms.rotate = i.initTransforms.rotate;
        characters[i.id].transforms.scale = i.initTransforms.scale;
        characters[i.id].transforms.opacity = i.initTransforms.opacity;

        const skin = i.initVariant !== null ? i.initVariant : characters[i.id].skins[0];
        characters[i.id].player.skeleton.setSkinByName(skin);

        const initAnim = i.initAnimation !== null ? i.initAnimation : "idle";

        if (characters[i.id].emotion !== initAnim) {
            characters[i.id].player.playAnimationWithTrack(0, initAnim, true);
            characters[i.id].emotion = initAnim;
        }

        characters[i.id].player.animationState.setEmptyAnimation(1, 4/60);
    }

    initEdits();
}

function initEdits() {
    if (!hasLoaded) return;
    for (const i of curCharacters) {
        if (i.initLayerEdits) {
            const layers = characters[i.id].player.animationState.data.skeletonData.defaultSkin.attachments;

            for (const j of Object.keys(characters[i.id].layerKeys)) {
                const n = characters[i.id].layerKeys[j];

                layers[n][j].color.r = layers[n][j].origColor.r;
                layers[n][j].color.g = layers[n][j].origColor.g;
                layers[n][j].color.b = layers[n][j].origColor.b;
                layers[n][j].color.a = layers[n][j].origColor.a;
            }

            for (const j of Object.keys(i.initLayerEdits)) {
                const n = characters[i.id].layerKeys[j];

                const col = hexToRgb(i.initLayerEdits[j].color);
                const alp = clamp(i.initLayerEdits[j].alpha, 0, 1);

                layers[n][j].color.r = col[0] / 255;
                layers[n][j].color.g = col[1] / 255;
                layers[n][j].color.b = col[2] / 255;
                layers[n][j].color.a = alp;
            }
        } else {
            i.initLayerEdits = {};
        }
    }
}

function updatePositionsToLatest() {
    for (let i = 0; i < curSelectedEntry + 1; i++) {
        curDialogue = i;
        parseDialogue(true);

        for (const i of tweens) {
            i.end();
        }
        
        if (curScenario[curDialogue] !== undefined && curDialogueState !== "choice" && curScenario[curDialogue].content.trim().length > 0) {
            skipOrProgress();
        }
    }
}

let entryClipboard = "";

window.addEventListener("keydown", (e) => {
    if (inEditor) return;

    if (e.key.toLowerCase() === "h" && curDialogueChoiceElements.length === 0) {
        controlHide.onclick();
    }
    if (e.shiftKey) {
        controlAuto.onclick();
    }
    if (e.key.toLowerCase() === "]") {
        controlSkip.onclick();
    }

    if (curDialogueChoiceElements.length > 0) return;

    if (e.key === " " && !curScenarioAuto) {
        skipOrProgress();
    }
});

window.addEventListener("keyup", (e) => {
    if (!inEditor) return;

    const currentElement = document.activeElement.tagName.toLowerCase();
    const elementFilters = [
        "input",
        "textarea"
    ];

    if (e.ctrlKey && !elementFilters.includes(currentElement)) {
        switch (e.key.toLowerCase()) {
            case "d": {
                if (!curScenario[curSelectedEntry]) return;
                const entry = curScenario[curSelectedEntry];
                curScenario.push(JSON.parse(JSON.stringify(entry)));
                updateDialogueList();
                selectDialogueEntry(curScenario.length - 1);
                break;
            }
            case "c": {
                if (!curScenario[curSelectedEntry]) return;
                const entry = curScenario[curSelectedEntry];
                entryClipboard = JSON.stringify(entry);
                break;
            }
            case "v": {
                if (!curScenario[curSelectedEntry]) return;
                const entry = JSON.parse(entryClipboard);
                curScenario.splice(curSelectedEntry + 1, 0, entry);
                updateDialogueList();
                selectDialogueEntry(curSelectedEntry + 1);
                break;
            }
            case "m": {
                dialogueAdd.dispatchEvent(new Event("click"));
                if (e.shiftKey && e.altKey) {
                    curScenario[curScenario.length - 1].type = "Speech";
                    curScenario[curScenario.length - 1].content = curScenario.length + "";

                    updateDialogueList();
                    selectDialogueEntry(curSelectedEntry);
                }
                break;
            }
            case "delete": {
                dialogueDel.dispatchEvent(new Event("click"));
                break;
            }
            case "l": {
                prompt({
                    title: "Load from JSON array",
                    label: "Load a dialogue from a JSON array (skuqre syntax)",
                    inputAttrs: {
                        type: 'text',
                        required: true
                    },
                    type: 'input',
                    skipTaskbar: false
                })
                .then(r => {
                    if (r !== null) {
                        const dialogue = JSON.parse(r);
                        curScenario = [];

                        for (const i of dialogue) {
                            dialogueAdd.dispatchEvent(new Event("click"));

                            const entry = curScenario[curScenario.length - 1];

                            entry.type = i.type;
                            entry.keyframeDuration = calcLength(i.text);

                            if (i.type !== "Choice") {
                                entry.speaker = i.speaker;
                                entry.content = i.text;
                            } else {
                                entry.choices = [
                                    {
                                        text: i.text,
                                        style: null,
                                        jump: null
                                    }
                                ];
                            }
                        }
            
                        updateDialogueList();
                        selectDialogueEntry(0);
                    }
                })
                .catch(console.error);
                break;
            }
            case "o": {
                worldImport.click();
                break;
            }
            case "s": {
                if (e.shiftKey) {
                    ipcRenderer.send("save-as-file");
                }

                worldExport.dispatchEvent(new Event("click"));
                break;
            }
        }
    }
});

const choiceKeybinds = "1234567890qwertyuiopasdfghjklzxcvbnm";
let alreadyPressing = null;

window.addEventListener("keydown", (e) => {
    if (inEditor) return;
    if (curDialogueChoiceElements.length === 0) return;
    if (alreadyPressing) return;

    const key = e.key.toLowerCase();
    if (choiceKeybinds.includes(key)) {
        const index = choiceKeybinds.indexOf(key);
        curDialogueChoiceElements[index].onmousedown();
        alreadyPressing = key;
    }
});

window.addEventListener("keyup", (e) => {
    if (inEditor) return;
    if (curDialogueChoiceElements.length === 0) return;

    const key = e.key.toLowerCase();

    if (alreadyPressing !== key) return;

    if (choiceKeybinds.includes(key)) {
        const index = choiceKeybinds.indexOf(key);
        curDialogueChoiceElements[index].onmouseup();
        alreadyPressing = null;
    }
});

window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();

    switch (key) {
        case "f11": {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
            break;
        }
    }
});

let shakeTimeout = null;

window.addEventListener("click", (e) => {
    if (inEditor) return;
    if (curScenarioAuto) return;
    if (!curScenarioShown) return;
    if (curDialogueChoiceElements.length > 0) {
        if (curDialogueChoiceElements.filter(el => mouseOverElement(el, e)).length === 0) {
            sfxChoiceError.cloneNode().play();

            dialogueChoiceList.style.animation = "choice-shake 0.2s infinite"

            if (shakeTimeout) {
                clearInterval(shakeTimeout);
            }

            shakeTimeout = setTimeout(() => {
                dialogueChoiceList.style.animation = null;
            }, 200);
        }
        return;
    }
    if ([controlHide, controlAuto, controlLog, controlSkip].filter(el => mouseOverElement(el, e)).length > 0) {
        return;
    }

    skipOrProgress();
});

window.addEventListener("mouseup", (e) => {
    if (inEditor) return;

    const touchFx = document.createElement("div");
    touchFx.classList.add("touch-fx");
    touchFx.style.left = e.clientX;
    touchFx.style.top = e.clientY;

    document.body.appendChild(touchFx);

    setTimeout(() => {
        touchFx.remove();
    }, 375)
});

//
var curSelectedEntry = null;
var curEntries = [];
const editorDialogueList = document.getElementById("editor-dialogue-list");

const dialogueAdd = document.getElementById("dialogue-add");
const dialogueDel = document.getElementById("dialogue-del");

function updateDialogueList() {
    editorDialogueList.innerHTML = "";
    curEntries = [];

    for (const i of curScenario) {
        const div = document.createElement("div");
        div.classList.add("generic-list-item");
        div.classList.add("dialogue-entry");
        div.draggable = true;

        let speaker = "";
        let content = "";
        let iconclass = "";
        switch (i.type) {
            case "Monologue":
                speaker = "";
                content = i.content;
                iconclass = "bx bxs-message-minus bx-flip-horizontal";
                break;
            case "Narration":
                speaker = "";
                content = i.content;
                iconclass = "bx bxs-info-circle";
                break;
            case "Choice":
                speaker = "";
                content = "<code>" + i.choices.map(e => e.text).join("</code><br><code>") + "</code>";
                iconclass = "bx bxs-message-dots bx-flip-horizontal";
                break;
            default:
                speaker = i.speaker;
                content = i.content;
                iconclass = "bx bxs-message-dots";
                break;
        }

        speaker = speaker === null ? "" : speaker;

        const icon = document.createElement("i");
        for (const i of iconclass.split(" ")) {
            icon.classList.add(i);
        }
        icon.style.color = "white";
        if (i.speaker in curColorDefinitions && i.type === "Speech") {
            icon.style.color = curColorDefinitions[i.speaker];
        }
        div.appendChild(icon);
        
        const colonCondition = speaker.trim().length > 0 && content.trim().length > 0;
        const span = document.createElement("span");
        span.innerHTML = (!["Monologue", "Narration", "Choice"].includes(i.type) ? `<b>${speaker}</b>` : "") + (colonCondition ? ": " : "") + `${content}`;
        div.appendChild(span);

        const highlight = document.createElement("div");
        highlight.classList.add("select-highlight");
        highlight.style.display = "none";
        div.appendChild(highlight);

        const jumpHighlight = document.createElement("div");
        jumpHighlight.classList.add("jump-highlight");
        jumpHighlight.style.display = "none";
        div.appendChild(jumpHighlight);

        const fromHighlight = document.createElement("div");
        fromHighlight.classList.add("from-highlight");
        fromHighlight.style.display = "none";
        div.appendChild(fromHighlight);

        editorDialogueList.appendChild(div);

        curEntries.push(div);

        div.onclick = () => {
            if (choosingChoiceJump) {
                selectJumpForChoice(curEntries.indexOf(div));
                return;
            }
            if (choosingDialogueJump) {
                selectJumpForDialogue(curEntries.indexOf(div));
                return;
            }

            selectDialogueEntry(curEntries.indexOf(div));
        }
    }
}

function selectDialogueEntry(to) {
    if (curScenario.length === 0){
        updateEditPanel();
        updateTimelineLines();
        return;
    }
    
    curSelectedEntry = to;

    for (const i of curEntries) {
        i.querySelector("div.select-highlight").style.display = "none";
        i.querySelector("div.jump-highlight").style.display = "none";
        i.querySelector("div.from-highlight").style.display = "none";
        i.title = "";
    }

    curEntries[curSelectedEntry].querySelector("div.select-highlight").style.display = "block";

    const entry = curScenario[curSelectedEntry];

    if (entry.jump !== null) {
        curEntries[entry.jump].querySelector("div.jump-highlight").style.display = "block";
        curEntries[entry.jump].title = "Seeing an orange border? That means the entry you have selected will be jumping (skipping) to the entry with the orange border."
    }

    // stop all talking models
    for (const i of Object.keys(characters)) {
        if (!characters[i].talking) continue;
        characters[i].player.playAnimationWithTrack(2, "talk_end", false);
        characters[i].player.queueNextEmpty(2, 4/60);
        characters[i].talking = false;
    }

    // end all tweens
    for (const i of tweens) {
        i.end();
    }

    const entriesWithJumps = [];

    for (let i = 0; i < curScenario.length; i++) {
        if (curScenario[i].jump !== null) {
            entriesWithJumps.push(i);
        }
    }

    for (let i = 0; i < curSelectedEntry; i++) {
        curDialogue = i;
        parseDialogue(!(i > curSelectedEntry - 2));

        // always.
        for (const i of tweens) {
            i.end();
        }
        
        if (curDialogueState !== "choice" && curScenario[curDialogue].content.trim().length > 0) {
            skipOrProgress();
        }
    }

    curBgmKey = null;
    curSfxKey = null;
    curVoKey = null;
    curBgmPlaying.pause();
    curSfxPlaying.pause();
    curVoPlaying.pause();

    curDialogue = curSelectedEntry;
    parseDialogue();

    let matchingFrom = null;
    for (const i of entriesWithJumps) {
        if (curScenario[i].jump === curSelectedEntry) {
            matchingFrom = i;
        }
    }

    if (matchingFrom !== null) {
        curEntries[matchingFrom].querySelector("div.from-highlight").style.display = "block";
        curEntries[matchingFrom].title = "Seeing a blue border? That means the entry you have selected will be coming from the entry with the blue border."

        if (entry.jump !== null) {
            curEntries[matchingFrom].querySelector("div.jump-highlight").style.borderStyle = "solid";
            curEntries[matchingFrom].title = "Seeing an alternating border? The entry you have selected will be coming to the entry with the alternating border, while the entry with the alternating border will be coming to the entry you have selected. Why is it so confusing?"
        } else {
            curEntries[matchingFrom].querySelector("div.jump-highlight").style.borderStyle = "dotted";
        }
    }

    if (curDialogueState === "choice") {
        updateChoices();
    }

    updateEditPanel();
    updateTimelineLines();
}

dialogueAdd.addEventListener("click", () => {
    const newEntry = {
    	type: "",
    	speaker: "",
        speakerModel: null,
        speakerModelEmotion: null,

        speakerModelPlayAnim: null,
        speakerModelLoopAnim: false,

        focusX: false,
        focusY: false,
        focusZ: false,
        focusR: false,
        focusDur: 1,
        focusPosX: 1920 / 2,
        focusPosY: 1080 / 2,
        focusZoom: 1.0,
        focusRot: 0,
        focusEaseType: "Sinusoidal",
        focusEaseDir: "InOut",

        fadeIn: false,
        fadeOut: false,
        fadeToBlack: false,
        fadeInDur: 1,
        fadeOutDur: 1,
        fadeBlackDur: 1,

        bg: {
            key: null,
            fade: false,
            fadeDur: 0.5,
            change: {
                x: false,
                y: false,
                s: false,
                r: false,
                changeX: 1920 / 2,
                changeY: 1080 / 2,
                changeS: 1.0,
                changeR: 0,
                changeDur: 1.0,
                changeEase: "Sinusoidal",
                changeEaseDir: "InOut"
            }
        },

        stopBgm: false,
        stopSfx: false,
        stopVo: false,
        stopBgmDur: 0.5,
        stopVoDur: 0.5,
        stopSfxDur: 0.5,

        bgm: {
            key: null,
            volume: 1,
            fade: false,
            fadeDur: 0.5
        },
        sfx: {
            key: null,
            volume: 1
        },
        vo: {
            key: null,
            volume: 1
        },

    	content: "",
    	keyframes: [],
        keyframeDuration: null,
        timeLocked: true,
    	choices: null,
        jump: null
    }

    curScenario.splice(curDialogue + 1, 0, newEntry);

    updateDialogueList();
    selectDialogueEntry(curScenario.indexOf(newEntry));
});

dialogueDel.addEventListener("click", () => {
    curScenario.splice(curSelectedEntry, 1);

    updateDialogueList();
    selectDialogueEntry(0);
});

var curSelectedCharacter = null;
var curCharEntries = [];
const editorCharacterList = document.getElementById("editor-character-list");

const characterAdd = document.getElementById("character-add");
const characterDel = document.getElementById("character-del");

const modelAddMain = document.getElementById("modeladd-main");
const modelAddSelector = document.getElementById("modeladd-selector");
const modelAddLoad = document.getElementById("modeladd-load");
const modelAddSearch = document.getElementById("modeladd-search");

const modelLoadMenu = document.getElementById("model-load");
const modelLoadList = document.getElementById("model-load-list");

const modelSearchQuery = document.getElementById("model-search-query");
const modelSearchRefresh = document.getElementById("model-search-refresh");
const modelSearchMenu = document.getElementById("model-search");
const modelSearchList = document.getElementById("model-search-list");
const modelSearchExit = document.getElementById("model-search-exit");

let curNKASModels = null;
let invertedModels = null;

function updateCharacterList() {
    editorCharacterList.innerHTML = "";
    curCharEntries = [];

    for (const i of curCharacters) {
        const div = document.createElement("div");
        div.classList.add("generic-list-item");
        div.classList.add("dialogue-entry");
        div.id = "character-entry-" + i.id;

        let iconclass = "";
        switch (i.type) {
            case "character":
                iconclass = "bx bxs-user-rectangle";
                break;
            case "image":
                iconclass = "bx bxs-image-alt";
                break;
        }

        const icon = document.createElement("i");
        for (const i of iconclass.split(" ")) {
            icon.classList.add(i);
        }
        icon.style.color = "white";
        if (i.name in curColorDefinitions) {
            icon.style.color = curColorDefinitions[i.name];
        }
        div.appendChild(icon);

        const span = document.createElement("span");
        span.innerHTML = `<b>${i.name}</b> (${i.id})`;
        div.appendChild(span);

        const highlight = document.createElement("div");
        highlight.classList.add("select-highlight");
        highlight.style.display = "none";
        div.appendChild(highlight);

        const immut = i.id;
        div.onclick = () => {
            selectCharacterEntry(immut);
        }

        editorCharacterList.appendChild(div);
        curCharEntries.push(div);
    }
}

function selectCharacterEntry(to) {
    curSelectedCharacter = to;
    
    for (const i of curCharEntries) {
        i.querySelector("div.select-highlight").style.display = "none";
    }

    if (curSelectedCharacter !== null) {
        document
            .getElementById("character-entry-" + curSelectedCharacter)
            .querySelector("div.select-highlight").style.display = "block";
    }

    updateInspectorPanel();
}

let draggingEntry = null;

editorDialogueList.addEventListener("dragstart", (e) => {
    if (draggingEntry !== null) return;
    draggingEntry = e.target;

    draggingEntry.style.opacity = 0.3;
});

editorDialogueList.addEventListener("dragend", (e) => {
    if (draggingEntry === null) return;

    const entryIndex = curEntries.indexOf(draggingEntry);

    const afterElement = getElementAfterDrag(curEntries, draggingEntry, e.clientY);
    let newIndex = null;
    if (afterElement == null) {
        newIndex = curScenario.length - 1;
    } else {
        newIndex = Array.from(editorDialogueList.children).indexOf(afterElement);
    }

    const selectedEntry = curScenario[curSelectedEntry];
    
    const [movedItem] = curScenario.splice(entryIndex, 1);
    curScenario.splice(newIndex, 0, movedItem);
    let newSelectedIndex = curScenario.indexOf(selectedEntry);

    updateDialogueList();
    selectDialogueEntry(newSelectedIndex);

    draggingEntry.style.opacity = 1;

    draggingEntry = null;
});

editorDialogueList.addEventListener("dragover", (e) => {
    if (draggingEntry === null) return;

    e.preventDefault();

    const afterElement = getElementAfterDrag(curEntries, draggingEntry, e.clientY);
    let newIndex = null;
    if (afterElement == null) {
        newIndex = curScenario.length - 1;
    } else {
        newIndex = Array.from(editorDialogueList.children).indexOf(afterElement);
    }

    for (const i of curEntries) {
        i.style.boxShadow = null;   
    }
    const w = newIndex === curSelectedEntry ? 8 : 4;
    curEntries[newIndex].style.boxShadow = `0 -${w}px 0 palegreen inset, 0 ${w}px 0 palegreen inset`;
});

async function getModelFromNKAS() {
    const req = await fetch("https://nkas-l2d.pages.dev/characters.json");
    const json = await req.json();

    curNKASModels = json;
    invertedModels = {};

    for (const i of Object.keys(curNKASModels)) {
        invertedModels[curNKASModels[i]] = i;
    }
}

let modelsAdding = 0;

function updateModelList(a) {
    modelSearchList.innerHTML = "";

    for (const i of a) {
        const immut = i;

        const div = document.createElement("div");
        div.classList.add("generic-list-item");
        div.classList.add("dialogue-entry");
        div.style.justifyContent = "space-between";

        const span = document.createElement("span");
        span.innerHTML = `<b>${i}</b> (${invertedModels[i]})`;
        div.appendChild(span);

        const img = document.createElement("img");
        img.classList.add("list-item-pre-bg");
        img.setAttribute("draggable", false);
        img.src = "https://nkas.pages.dev/characters/si_" + invertedModels[immut] + "_s.png";
        img.onerror = () => {
            img.style.display = "none";
        }
        div.appendChild(img);

        const img2 = document.createElement("img");
        img2.classList.add("list-item-pre");
        img2.setAttribute("draggable", false);
        img2.src = "https://nkas.pages.dev/characters/si_" + invertedModels[immut] + "_s.png";
        img2.onerror = () => {
            img2.style.display = "none";
        }
        div.appendChild(img2);

        const tray = document.createElement("div");
        tray.classList.add("button-tray");

        const buttonIcons = {
            idle: `<i class="bx bx-plus"></i>`,
            aim: `<img src="../assets/images/icon_attacker.png" />`,
            cover: `<img src="../assets/images/icon_defender.png" />`,
        }
        for (const n of ["idle", "aim", "cover"]) {
            const icon = buttonIcons[n];

            const button = document.createElement("div");
            button.classList.add("button");
            button.classList.add("green");
            button.innerHTML = icon;

            button.onclick = async () => {
                if (button.getAttribute("active") == "false") return;
                modelsAdding += 1;

                button.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
                button.setAttribute("active", false);

                let req;
                let json;

                try {
                    req = await fetch("https://nkas-l2d.pages.dev/characters/" + invertedModels[immut] + "/" + n + "/data.json")
                    json = await req.json();
                } catch(e) {
                    popUpError(`No ${n} model for ${immut} available.<br>(${e})`);

                    button.innerHTML = icon;
                    button.setAttribute("active", true);
                    modelsAdding -= 1;

                    return;
                }

                const dupes = curCharacters.filter(e => e.id.startsWith(invertedModels[immut]));

                const fileNameTentative = invertedModels[immut].split("_");
                fileNameTentative.splice(1, 0, n)
                const filename = n === "idle" ? invertedModels[immut] : fileNameTentative.join("_");

                curCharacters.push({
                    id: filename + (dupes.length > 0 ? "_" + dupes.length : ""),
                    type: "character",
                    name: immut,
                    ver: json.ver,
                    initAnimation: n === "idle" ? "idle" : n + "_idle",
                    initVariant: null,
                    initTransforms: {
                        x: 1920 * 0.5,
                        y: 1080 * 0.9,
                        scale: 1,
                        rotate: 0,
                        opacity: 1
                    },
                    customPath: "https://nkas-l2d.pages.dev/characters/" + invertedModels[immut] + "/" + n + "/" + filename,
                    initLayerEdits: {}
                });

                button.innerHTML = `<i class="bx bx-check"></i>`;
                modelsAdding -= 1;

                setTimeout(() => {
                    button.innerHTML = icon;
                    button.setAttribute("active", true);
                }, 500);
            }

            tray.appendChild(button);
        }

        div.appendChild(tray);

        modelSearchList.appendChild(div);
    }


}

characterAdd.addEventListener("click", () => {
    modelAddMain.style.display = "flex";
    modelAddSelector.style.display = "flex";
});

characterDel.addEventListener("click", () => {
    if (curSelectedCharacter === null) return;

    if (curScenario[curSelectedEntry]) {
        if (curScenario[curSelectedEntry].speakerModel === curSelectedCharacter) {
            curScenario[curSelectedEntry].speakerModel = null;
        }
    }

    deleteCharacter(curSelectedCharacter);
    curCharacters = curCharacters.filter((e) => e.id !== curSelectedCharacter);

    updateCharacterList();
    selectCharacterEntry(null); 

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

modelAddLoad.addEventListener("click", () => {
    modelAddSelector.style.display = "none";
    modelLoadMenu.style.display = "flex";
    modelSearchMenu.style.display = "none";
});

modelAddSearch.addEventListener("click", () => {
    modelAddSelector.style.display = "none";
    modelLoadMenu.style.display = "none";
    modelSearchMenu.style.display = "flex";

    if (curNKASModels === null) {
        getModelFromNKAS()
            .then(() => {
                updateModelList(Object.values(curNKASModels));
            })
            .catch((e) => {
                console.log("Error...", e)
            });
    }
});

modelSearchQuery.addEventListener("input", () => {
    const results = fuzzysort.go(modelSearchQuery.value.trim(), Object.values(curNKASModels), {all: true});
    const resultStrings = [];

    for (const i of results) {
        resultStrings.push(i.target);
    }

    updateModelList(resultStrings);
});

modelSearchRefresh.addEventListener("click", () => {
    modelSearchList.innerHTML = "";

    getModelFromNKAS()
        .then(() => {
            updateModelList(Object.values(curNKASModels));
        })
        .catch((e) => {
            console.log("Error...", e)
        });
});

modelSearchExit.addEventListener("click", () => {
    if (modelsAdding > 0) return;

    modelAddMain.style.display = "none";
    modelAddSelector.style.display = "none";
    modelLoadMenu.style.display = "none";
    modelSearchMenu.style.display = "none";

    hasLoaded = false;
    init();
})

const bgmToggle = document.getElementById("bgm-toggle");
const sfxToggle = document.getElementById("sfx-toggle");
const voToggle = document.getElementById("vo-toggle");

bgmToggle.addEventListener("click", () => {
    canBgmPlay = !canBgmPlay;

    curBgmKey = null;
    curBgmPlaying.pause();
    bgmToggle.style.color = canBgmPlay ? "var(--accent)" : "var(--text-color-disabled)";

    selectDialogueEntry(curSelectedEntry);
});

sfxToggle.addEventListener("click", () => {
    canSfxPlay = !canSfxPlay;

    curSfxKey = null;
    curSfxPlaying.pause();
    sfxToggle.style.color = canSfxPlay ? "var(--accent)" : "var(--text-color-disabled)";

    selectDialogueEntry(curSelectedEntry);
});

voToggle.addEventListener("click", () => {
    canVoPlay = !canVoPlay;

    curVoKey = null;
    curVoPlaying.pause();
    voToggle.style.color = canVoPlay ? "var(--accent)" : "var(--text-color-disabled)";

    selectDialogueEntry(curSelectedEntry);
});

const editorList = document.getElementById("editor-edit-list");
const editorInst = document.getElementById("editor-edit-inst");

const fieldDialogueType = document.getElementById("field-dialogue-type");

const fieldDialogueName = document.getElementById("field-dialogue-name");
const fieldDialogueContent = document.getElementById("field-dialogue-content");
const fieldDialogueCharacter = document.getElementById("field-dialogue-charid");
const fieldDialogueEmotion = document.getElementById("field-dialogue-emotion");
const fieldDialogueMatchInit = document.getElementById("field-dialogue-matchinit");

const fieldDialoguePlayAnim = document.getElementById("field-dialogue-playanim");
const fieldDialogueRemoveAnim = document.getElementById("field-dialogue-removeanim");
const fieldDialogueLoopAnim = document.getElementById("field-dialogue-loopanim")

const fieldDialogueFocusX = document.getElementById("field-dialogue-focx");
const fieldDialogueFocusY = document.getElementById("field-dialogue-focy");
const fieldDialogueFocusZ = document.getElementById("field-dialogue-focz");
const fieldDialogueFocusR = document.getElementById("field-dialogue-focr");
const fieldDialogueFocusPosX = document.getElementById("field-dialogue-foctox");
const fieldDialogueFocusPosY = document.getElementById("field-dialogue-foctoy");
const fieldDialogueFocusPosZ = document.getElementById("field-dialogue-foctoz");
const fieldDialogueFocusPosR = document.getElementById("field-dialogue-foctor");

const fieldDialogueFocusDur = document.getElementById("field-dialogue-focd");
const fieldDialogueEaseType = document.getElementById("field-dialogue-foceasetype");
const fieldDialogueEaseDir = document.getElementById("field-dialogue-foceasedir");

const fieldDialogueFadeIn = document.getElementById("field-dialogue-fadein");
const fieldDialogueFadeOut = document.getElementById("field-dialogue-fadeout");
const fieldDialogueFadeBlack = document.getElementById("field-dialogue-fadeblack");
const fieldDialogueFadeInDur = document.getElementById("field-dialogue-fadeindur");
const fieldDialogueFadeOutDur = document.getElementById("field-dialogue-fadeoutdur");
const fieldDialogueFadeBlackDur = document.getElementById("field-dialogue-fadeblackdur");

const fieldDialogueChangeBG = document.getElementById("field-dialogue-changebg")
const fieldDialogueChangeBGLink = document.getElementById("field-dialogue-changebglink")
const fieldDialogueChangeBGLoad = document.getElementById("field-dialogue-changebgload")
const fieldDialogueFadeBG = document.getElementById("field-dialogue-fadebg")
const fieldDialogueFadeBGDur = document.getElementById("field-dialogue-fadebgdur")

const fieldDialogueChangeBGX = document.getElementById("field-dialogue-cbgx")
const fieldDialogueChangeBGY = document.getElementById("field-dialogue-cbgy")
const fieldDialogueChangeBGS = document.getElementById("field-dialogue-cbgs")
const fieldDialogueChangeBGR = document.getElementById("field-dialogue-cbgr")
const fieldDialogueChangeBGToX = document.getElementById("field-dialogue-cbgtox")
const fieldDialogueChangeBGToY = document.getElementById("field-dialogue-cbgtoy")
const fieldDialogueChangeBGToS = document.getElementById("field-dialogue-cbgtos")
const fieldDialogueChangeBGToR = document.getElementById("field-dialogue-cbgtor")
const fieldDialogueChangeBGDur = document.getElementById("field-dialogue-cbgdur")
const fieldDialogueChangeBGEaseType = document.getElementById("field-dialogue-cbgeasetype")
const fieldDialogueChangeBGEaseDir = document.getElementById("field-dialogue-cbgeasedir")

const fieldDialogueStopBGM = document.getElementById("field-dialogue-stopbgm")
const fieldDialogueStopSFX = document.getElementById("field-dialogue-stopsfx")
const fieldDialogueStopVO = document.getElementById("field-dialogue-stopvo")
const fieldDialogueStopBGMDur = document.getElementById("field-dialogue-stopbgmdur")
const fieldDialogueStopSFXDur = document.getElementById("field-dialogue-stopsfxdur")
const fieldDialogueStopVODur = document.getElementById("field-dialogue-stopvodur")

const fieldDialoguePlayBGM = document.getElementById("field-dialogue-playbgm");
const fieldDialoguePlayBGMLink = document.getElementById("field-dialogue-playbgmlink");
const fieldDialoguePlayBGMLoad = document.getElementById("field-dialogue-playbgmload");
const fieldDialoguePlayBGMVolume = document.getElementById("field-dialogue-bgmvolval");
const fieldDialoguePlayBGMFade = document.getElementById("field-dialogue-bgmfade");
const fieldDialoguePlayBGMFadeDur = document.getElementById("field-dialogue-bgmfadedur");

const fieldDialoguePlaySFX = document.getElementById("field-dialogue-playsfx");
const fieldDialoguePlaySFXLink = document.getElementById("field-dialogue-playsfxlink");
const fieldDialoguePlaySFXLoad = document.getElementById("field-dialogue-playsfxload");
const fieldDialoguePlaySFXVolume = document.getElementById("field-dialogue-sfxvolval");

const fieldDialoguePlayVO = document.getElementById("field-dialogue-playvo");
const fieldDialoguePlayVOLink = document.getElementById("field-dialogue-playvolink");
const fieldDialoguePlayVOLoad = document.getElementById("field-dialogue-playvoload");
const fieldDialoguePlayVOVolume = document.getElementById("field-dialogue-vovolval");

const fieldDialogueTLDurLock = document.getElementById("field-dialogue-tldurlock");
const fieldDialogueTLDur = document.getElementById("field-dialogue-tldur");

const fieldDialogueEntryJumpEyedropper = document.getElementById("field-dialogue-entryjumpeyedropper")
const fieldDialogueEntryJumpRemove = document.getElementById("field-dialogue-entryjumpremove")
const fieldDialogueEntryJumpIndex = document.getElementById("field-dialogue-entryjumpindex")

const fieldNarrationContent = document.getElementById("field-dialogue-ncontent");
const fieldMonologueContent = document.getElementById("field-dialogue-mcontent");

const fieldChoiceAdd = document.getElementById("field-choice-add");
const fieldChoiceList = document.getElementById("field-choice-list");

function updateEditPanel() {
    const entry = curScenario[curDialogue];

    if (!entry) {
        editorList.style.display = "none";
        editorInst.style.display = "";
        return;
    } else {
        editorList.style.display = "";
        editorInst.style.display = "none";
    }

    fieldDialogueType.value = entry.type;

    for (const i of fieldDialogueType.options) {
        const groupName = "field-group-" + i.value.toLowerCase();
        const groupElement = document.getElementsByClassName(groupName);

        for (const e of groupElement) {
            e.style.display = "none";
        }
    }

    const allGroup = document.getElementsByClassName("field-group-all");
    if (entry.type === "") {
        for (const e of allGroup) {
            e.style.display = "none";
        }
    } else {
        for (const e of allGroup) {
            e.style.display = "";
        }
    }

    const selectedGroupName = fieldDialogueType.value.toLowerCase();
    const selectedGroupElement = document.getElementsByClassName("field-group-" + selectedGroupName);

    for (const e of selectedGroupElement) {
        e.style.display = "";
    }

    fieldDialogueLoopAnim.innerHTML = entry.speakerModelLoopAnim ? "<i class='bx bx-check'></i>" : "";

    fieldDialogueFocusX.innerHTML = entry.focusX ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusY.innerHTML = entry.focusY ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusZ.innerHTML = entry.focusZ ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusR.innerHTML = entry.focusR ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusPosX.value = entry.focusPosX;
    fieldDialogueFocusPosY.value = entry.focusPosY;
    fieldDialogueFocusPosZ.value = entry.focusZoom;
    fieldDialogueFocusPosR.value = entry.focusRot;
    fieldDialogueFocusDur.value = entry.focusDur !== null ? entry.focusDur : 1;

    fieldDialogueStopBGM.innerHTML = entry.stopBgm ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueStopSFX.innerHTML = entry.stopSfx ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueStopVO.innerHTML = entry.stopVo ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueStopBGMDur.value = entry.stopBgmDur;
    fieldDialogueStopSFXDur.value = entry.stopSfxDur;
    fieldDialogueStopVODur.value = entry.stopVoDur;

    if (entry.stopBgm) {
        fieldDialogueStopBGMDur.removeAttribute("disabled");
    } else {
        fieldDialogueStopBGMDur.setAttribute("disabled", "");
    }

    if (entry.stopSfx) {
        fieldDialogueStopSFXDur.removeAttribute("disabled");
    } else {
        fieldDialogueStopSFXDur.setAttribute("disabled", "");
    }

    if (entry.stopVo) {
        fieldDialogueStopVODur.removeAttribute("disabled");
    } else {
        fieldDialogueStopVODur.setAttribute("disabled", "");
    }

    fieldDialogueFadeIn.innerHTML = entry.fadeIn ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFadeOut.innerHTML = entry.fadeOut ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFadeBlack.innerHTML = entry.fadeToBlack ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFadeInDur.value = entry.fadeInDur;
    fieldDialogueFadeOutDur.value = entry.fadeOutDur;
    fieldDialogueFadeBlackDur.value = entry.fadeBlackDur;

    fieldDialogueChangeBG.innerHTML = `<option value="???">None (don't change)</option>`;
    for (const i of Object.keys(loadedBgs)) {
        fieldDialogueChangeBG.innerHTML += `
        <option value="${i}">${i}</option>
        `;
    }
    fieldDialogueChangeBG.value = entry.bg.key ?? "???";

    fieldDialogueFadeBG.innerHTML = entry.bg.fade ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFadeBGDur.value = entry.bg.fadeDur;

    fieldDialogueChangeBGX.innerHTML = entry.bg.change.x ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueChangeBGY.innerHTML = entry.bg.change.y ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueChangeBGS.innerHTML = entry.bg.change.s ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueChangeBGR.innerHTML = entry.bg.change.r ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueChangeBGToX.value = entry.bg.change.changeX;
    fieldDialogueChangeBGToY.value = entry.bg.change.changeY;
    fieldDialogueChangeBGToS.value = entry.bg.change.changeS;
    fieldDialogueChangeBGToR.value = entry.bg.change.changeR;

    if (entry.bg.change.x) {
        fieldDialogueChangeBGToX.removeAttribute("disabled");
    } else {
        fieldDialogueChangeBGToX.setAttribute("disabled", "");
    }

    if (entry.bg.change.y) {
        fieldDialogueChangeBGToY.removeAttribute("disabled");
    } else {
        fieldDialogueChangeBGToY.setAttribute("disabled", "");
    }

    if (entry.bg.change.s) {
        fieldDialogueChangeBGToS.removeAttribute("disabled");
    } else {
        fieldDialogueChangeBGToS.setAttribute("disabled", "");
    }

    if (entry.bg.change.r) {
        fieldDialogueChangeBGToR.removeAttribute("disabled");
    } else {
        fieldDialogueChangeBGToR.setAttribute("disabled", "");
    }

    fieldDialogueChangeBGDur.value = entry.bg.change.changeDur;
    fieldDialogueChangeBGEaseType.innerHTML = "";
    for (const i of Object.getOwnPropertyNames(Easing)) {
        if (i.trim().toLowerCase() !== "generatepow") {
            fieldDialogueChangeBGEaseType.innerHTML += `<option value="${i}">${i}</option>`
        }
    }
    fieldDialogueChangeBGEaseType.value = entry.bg.change.changeEase;
    fieldDialogueChangeBGEaseDir.value = entry.bg.change.changeEaseDir;

    if (entry.bg.fade) {
        fieldDialogueFadeBGDur.removeAttribute("disabled");
    } else {
        fieldDialogueFadeBGDur.setAttribute("disabled", "");
    }

    fieldDialoguePlayBGM.innerHTML = `<option value="???">None</option>`;
    for (const i of Object.keys(loadedBgm)) {
        fieldDialoguePlayBGM.innerHTML += `
        <option value="${i}">${i}</option>
        `;
    }
    fieldDialoguePlayBGM.value = entry.bgm.key ?? "???";

    fieldDialoguePlayBGMVolume.value = entry.bgm.volume;
    fieldDialoguePlayBGMFade.innerHTML = entry.bgm.fade ? "<i class='bx bx-check'></i>" : "";
    fieldDialoguePlayBGMFadeDur.value = entry.bgm.fadeDur;

    if (entry.bgm.fade) {
        fieldDialoguePlayBGMFadeDur.removeAttribute("disabled");
    } else {
        fieldDialoguePlayBGMFadeDur.setAttribute("disabled", "");
    }

    fieldDialoguePlaySFX.innerHTML = `<option value="???">None</option>`;
    for (const i of Object.keys(loadedSfx)) {
        fieldDialoguePlaySFX.innerHTML += `
        <option value="${i}">${i}</option>
        `;
    }
    fieldDialoguePlaySFX.value = entry.sfx.key ?? "???";

    fieldDialoguePlaySFXVolume.value = entry.sfx.volume;

    fieldDialoguePlayVO.innerHTML = `<option value="???">None</option>`;
    for (const i of Object.keys(loadedVo)) {
        fieldDialoguePlayVO.innerHTML += `
        <option value="${i}">${i}</option>
        `;
    }
    fieldDialoguePlayVO.value = entry.vo.key ?? "???";

    fieldDialoguePlayVOVolume.value = entry.vo.volume;

    fieldDialogueEaseType.innerHTML = "";
    for (const i of Object.getOwnPropertyNames(Easing)) {
        if (i.trim().toLowerCase() !== "generatepow") {
            fieldDialogueEaseType.innerHTML += `<option value="${i}">${i}</option>`
        }
    }

    fieldDialogueEaseType.value = entry.focusEaseType;
    fieldDialogueEaseDir.value = entry.focusEaseDir;

    if (entry.focusX) {
        fieldDialogueFocusPosX.removeAttribute("disabled");
    } else {
        fieldDialogueFocusPosX.setAttribute("disabled", "");
    }

    if (entry.focusY) {
        fieldDialogueFocusPosY.removeAttribute("disabled");
    } else {
        fieldDialogueFocusPosY.setAttribute("disabled", "");
    }

    if (entry.focusZ) {
        fieldDialogueFocusPosZ.removeAttribute("disabled");
    } else {
        fieldDialogueFocusPosZ.setAttribute("disabled", "");
    }

    if (entry.focusR) {
        fieldDialogueFocusPosR.removeAttribute("disabled");
    } else {
        fieldDialogueFocusPosR.setAttribute("disabled", "");
    }

    if (entry.fadeIn) {
        fieldDialogueFadeInDur.removeAttribute("disabled");
    } else {
        fieldDialogueFadeInDur.setAttribute("disabled", "");
    }

    if (entry.fadeOut) {
        fieldDialogueFadeOutDur.removeAttribute("disabled");
    } else {
        fieldDialogueFadeOutDur.setAttribute("disabled", "");
    }

    if (entry.fadeToBlack) {
        fieldDialogueFadeBlackDur.removeAttribute("disabled");
    } else {
        fieldDialogueFadeBlackDur.setAttribute("disabled", "");
    }

    fieldDialogueTLDurLock.innerHTML = entry.timeLocked ? "<i class='bx bxs-lock-alt'></i>" : "<i class='bx bxs-lock-open-alt'></i>";
    fieldDialogueTLDurLock.style.color = entry.timeLocked ? "var(--accent)" : "var(--text-color-disabled)";

    const num = Math.max(entry.keyframeDuration, calcLength(entry.content));
    fieldDialogueTLDur.value = num;

    if (!entry.timeLocked) {
        fieldDialogueTLDur.removeAttribute("disabled");
    } else {
        fieldDialogueTLDur.setAttribute("disabled", "");
    }

    fieldDialogueEntryJumpIndex.value = entry.jump;

    switch (entry.type) {
        case "Speech":
            fieldDialogueName.value = entry.speaker;
            fieldDialogueContent.value = entry.content;

            fieldDialogueCharacter.innerHTML = "<option value=\"none\">None</option>";
            for (const i of curCharacters) {
                const option = document.createElement("option");
                option.value = i.id;
                option.innerHTML = `${i.name} (${i.id})`;
                fieldDialogueCharacter.appendChild(option);
            }
            fieldDialogueCharacter.value = entry.speakerModel === null ? "none" : entry.speakerModel;

            if (entry.speakerModel !== null) {
                fieldDialogueEmotion.innerHTML = "";

                fieldDialogueEmotion.removeAttribute("disabled");
                fieldDialogueMatchInit.removeAttribute("disabled");

                if (characters[entry.speakerModel]) {
                    for (const i of characters[entry.speakerModel].emotions) {
                        if (i.trim().toLowerCase() === "talk_start" || 
                            i.trim().toLowerCase() === "talk_end") continue;
                        
                        const option = document.createElement("option");
                        option.value = i;
                        option.innerHTML = i;
                        fieldDialogueEmotion.appendChild(option);
                    }
                }
    
                fieldDialogueEmotion.value = entry.speakerModelEmotion;

                fieldDialoguePlayAnim.removeAttribute("disabled");
                fieldDialogueRemoveAnim.removeAttribute("disabled");
                fieldDialogueLoopAnim.removeAttribute("disabled");

                fieldDialoguePlayAnim.innerHTML = "";
                for (const i of characters[entry.speakerModel].emotions) {
                    if (i.trim().toLowerCase() === "talk_start" || 
                        i.trim().toLowerCase() === "talk_end") continue;
                    
                    const option = document.createElement("option");
                    option.value = i;
                    option.innerHTML = i;
                    fieldDialoguePlayAnim.appendChild(option);
                }
                fieldDialoguePlayAnim.value = entry.speakerModelPlayAnim;
            } else {
                fieldDialogueEmotion.innerHTML = "<option selected value=\"none\">No model selected</option>";
                fieldDialogueEmotion.setAttribute("disabled", "");
                fieldDialogueMatchInit.setAttribute("disabled", "");

                fieldDialoguePlayAnim.innerHTML = "<option selected value=\"none\">No model selected</option>";
                fieldDialoguePlayAnim.setAttribute("disabled", "");
                fieldDialogueRemoveAnim.setAttribute("disabled", "");
                fieldDialogueLoopAnim.setAttribute("disabled", "");
            }
            break;
        case "Choice":
            fieldChoiceList.innerHTML = "";

            for (const i of entry.choices) {
                const div = document.createElement("div")
                div.classList.add("generic-list-item");
        
                const choiceText = document.createElement("textarea")
                choiceText.value = i.text;
                choiceText.style.width = "194px"
                choiceText.style.height = "32px";
                div.appendChild(choiceText);

                const immut = entry.choices.indexOf(i);
        
                choiceText.onchange = () => {
                    const entry = curScenario[curDialogue];

                    entry.choices[immut].text = choiceText.value;

                    updateDialogueList();
                    selectDialogueEntry(curSelectedEntry);
                }

                const tray = document.createElement("div");
                tray.classList.add("button-tray");

                const changeJump = document.createElement("div");
                changeJump.classList.add("button");
                changeJump.classList.add("white");
                changeJump.innerHTML = `<i class="bx bxs-edit-location"></i>`;
                changeJump.title = "Change the index the choice will jump (skip) to, akin to an eyedropper."
                tray.appendChild(changeJump)

                const removeJump = document.createElement("div");
                removeJump.classList.add("button");
                removeJump.classList.add("red");
                removeJump.innerHTML = removeJumpSymbol;
                removeJump.title = "Remove the index";
                tray.appendChild(removeJump);

                const jumpLocation = document.createElement("input");
                jumpLocation.setAttribute("type", "number");
                jumpLocation.setAttribute("min", "0");
                jumpLocation.style.width = "64px";
                jumpLocation.title = "This is the index the choice will make the scenario jump to."
                tray.appendChild(jumpLocation);

                jumpLocation.value = entry.choices[immut].jump;

                const trash = document.createElement("div");
                trash.classList.add("button");
                trash.classList.add("red");
                trash.innerHTML = `<i class="bx bx-trash"></i>`;
                tray.appendChild(trash)

                changeJump.onclick = () => {
                    choosingChoiceJump = true;
                    choiceEditing = immut;
                }

                removeJump.onclick = () => {
                    const entry = curScenario[curDialogue];

                    entry.choices[immut].jump = null;

                    updateDialogueList();
                    selectDialogueEntry(curSelectedEntry);
                }

                jumpLocation.oninput = () => {
                    const entry = curScenario[curDialogue];

                    entry.choices[immut].jump = parseInt(jumpLocation.value);

                    updateDialogueList();
                    selectDialogueEntry(curSelectedEntry);
                }

                trash.onclick = () => {
                    const entry = curScenario[curDialogue];

                    entry.choices.splice(immut, 1);

                    updateDialogueList();
                    selectDialogueEntry(curSelectedEntry);
                }

                div.appendChild(tray);

                fieldChoiceList.appendChild(div);
            }
        case "Narration":
            fieldNarrationContent.value = entry.content;
            break;
        case "Monologue":
            fieldMonologueContent.value = entry.content;
            break;
    }
}

let choosingChoiceJump = false;
let choiceEditing = null;

function selectJumpForChoice(jumpIndex) {
    if (choiceEditing === null) return;
    if (!curScenario[curDialogue]) return;
    const entry = curScenario[curDialogue];

    if (entry.choices && entry.choices[choiceEditing]) {
        entry.choices[choiceEditing].jump = jumpIndex;
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);

    choosingChoiceJump = false;
    choiceEditing = null;
}

let choosingDialogueJump = false;

function selectJumpForDialogue(jumpIndex) {
    if (!curScenario[curDialogue]) return;

    const entry = curScenario[curDialogue];

    entry.jump = jumpIndex;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);

    choosingDialogueJump = false;
}

let isColorDefOpen = false;
const colordefOpen = document.getElementById("colordef-open");
const colordefMain = document.getElementById("colordef-main");
const colordefSave = document.getElementById("colordef-save");
const colordefList = document.getElementById("colordef-list");
const colordefAdd = document.getElementById("colordef-add");

colordefOpen.addEventListener("click", () => {
    isColorDefOpen = true;

    colordefMain.style.opacity = isColorDefOpen ? "1" : "0";
    colordefMain.style.display = isColorDefOpen ? "flex" : "none";

    updateColorDefPopup();
});

colordefSave.addEventListener("click", () => {
    isColorDefOpen = false;

    colordefMain.style.opacity = isColorDefOpen ? "1" : "0";
    colordefMain.style.display = isColorDefOpen ? "flex" : "none";
});

colordefAdd.addEventListener("click", () => {
    curColorDefinitions["New Color Definition"] = "#ffffff";

    updateColorDefPopup();
});

function updateColorDefPopup() {
    colordefList.innerHTML = "";

    for (const i of Object.keys(curColorDefinitions)) {
        const color = curColorDefinitions[i];

        const div = document.createElement("div")
        div.classList.add("generic-list-item");

        const defName = document.createElement("input")
        defName.setAttribute("type", 'text');
        defName.value = i;
        div.appendChild(defName);

        const defColor = document.createElement("input");
        defColor.setAttribute("type", 'color');
        defColor.value = color;
        div.appendChild(defColor)

        const immut = i;

        defName.onchange = () => {
            const defKeys = Object.keys(curColorDefinitions);
            const defValues = Object.values(curColorDefinitions);

            for (const i of defKeys) {
                delete curColorDefinitions[i];
            }
            
            defKeys[defKeys.indexOf(immut)] = defName.value;

            for (let i = 0; i < defKeys.length; i++) {
                curColorDefinitions[defKeys[i]] = defValues[i];
            }

            updateColorDefPopup();
        }

        defColor.onchange = () => {
            curColorDefinitions[immut] = defColor.value;
            updateColorDefPopup();
        }

        colordefList.appendChild(div);
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
    updateCharacterList();
}

fieldDialogueType.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.type = fieldDialogueType.value;

    switch (entry.type) {
        case "Speech":
            if (entry.speaker === null)
                entry.speaker = "";
            if (entry.speakerModel === null)
                entry.speaker = null;
            if (entry.speakerModelEmotion === null)
                entry.speakerModelEmotion = null;
            if (entry.speakerModelPlayAnim === null)
                entry.speakerModelPlayAnim = null;
            if (entry.content === null)
                entry.content = "";

            break;
        case "Choice":
            if (entry.choices === null)
                entry.choices = [];

            break;
        case "Monologue":
        case "Narration":
            if (entry.content === null)
                entry.content = "";
            break;
    }

    parseDialogue();

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueName.addEventListener("change", () => {
    const entry = curScenario[curDialogue];

    entry.speaker = fieldDialogueName.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueContent.addEventListener("change", () => {
    const entry = curScenario[curDialogue];

    entry.content = fieldDialogueContent.value;

    if (entry.keyframeDuration < calcLength(entry.content)) {
        entry.keyframeDuration = calcLength(entry.content);
    }

    if (entry.timeLocked) {
        entry.keyframeDuration = calcLength(entry.content);
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueCharacter.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.speakerModel = fieldDialogueCharacter.value === "none" ? null : fieldDialogueCharacter.value;

    if (entry.speakerModel !== null) {
        fieldDialogueEmotion.innerHTML = "";

        for (const i of characters[entry.speakerModel].emotions) {
            if (i.trim().toLowerCase() === "talk_start" || 
                i.trim().toLowerCase() === "talk_end") continue;
            
            const option = document.createElement("option");
            option.value = i;
            option.innerHTML = i;
            fieldDialogueEmotion.appendChild(option);
        }
        fieldDialogueEmotion.value = entry.speakerModelEmotion;

        fieldDialoguePlayAnim.innerHTML = "";
        for (const i of characters[entry.speakerModel].emotions) {
            if (i.trim().toLowerCase() === "talk_start" || 
                i.trim().toLowerCase() === "talk_end") continue;
            
            const option = document.createElement("option");
            option.value = i;
            option.innerHTML = i;
            fieldDialoguePlayAnim.appendChild(option);
        }
        fieldDialoguePlayAnim.value = entry.speakerModelPlayAnim;
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueEmotion.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.speakerModelEmotion = fieldDialogueEmotion.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueMatchInit.addEventListener("click", () => {
    const entry = curScenario[curDialogue];
    const character = curCharacters.filter((e) => e.id === entry.speakerModel)[0];

    entry.speakerModelEmotion = character.initAnimation;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialoguePlayAnim.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.speakerModelPlayAnim = fieldDialoguePlayAnim.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueRemoveAnim.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.speakerModelPlayAnim = null;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueLoopAnim.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.speakerModelLoopAnim = !entry.speakerModelLoopAnim;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

const dialogueFields = [
    { f: fieldDialogueFocusX, p: "focusX", t: "bool" },
    { f: fieldDialogueFocusY, p: "focusY", t: "bool" },
    { f: fieldDialogueFocusZ, p: "focusZ", t: "bool" },
    { f: fieldDialogueFocusR, p: "focusR", t: "bool" },

    { f: fieldDialogueFocusPosX, p: "focusPosX", t: "num"},
    { f: fieldDialogueFocusPosY, p: "focusPosY", t: "num"},
    { f: fieldDialogueFocusPosZ, p: "focusZoom", t: "num"},
    { f: fieldDialogueFocusPosR, p: "focusRot", t: "num"},

    { f: fieldDialogueFocusDur, p: "focusDur", t: "num"},

    { f: fieldDialogueFadeIn, p: "fadeIn", t: "bool" },
    { f: fieldDialogueFadeOut, p: "fadeOut", t: "bool" },
    { f: fieldDialogueFadeBlack, p: "fadeToBlack", t: "bool" },

    { f: fieldDialogueFadeInDur, p: "fadeInDur", t: "num" },
    { f: fieldDialogueFadeOutDur, p: "fadeOutDur", t: "num" },
    { f: fieldDialogueFadeBlackDur, p: "fadeBlackDur", t: "num" },

    { f: fieldDialogueFadeBG, p: "bg.fade", t: "bool"},
    { f: fieldDialogueFadeBGDur, p: "bg.fadeDur", t: "num"},

    { f: fieldDialogueChangeBGX, p: "bg.change.x", t: "bool"},
    { f: fieldDialogueChangeBGY, p: "bg.change.y", t: "bool"},
    { f: fieldDialogueChangeBGS, p: "bg.change.s", t: "bool"},
    { f: fieldDialogueChangeBGR, p: "bg.change.r", t: "bool"},

    { f: fieldDialogueChangeBGToX, p: "bg.change.changeX", t: "num"},
    { f: fieldDialogueChangeBGToY, p: "bg.change.changeY", t: "num"},
    { f: fieldDialogueChangeBGToS, p: "bg.change.changeS", t: "num"},
    { f: fieldDialogueChangeBGToR, p: "bg.change.changeR", t: "num"},


    { f: fieldDialogueChangeBG, p: "bg.key", t: "select???null" },
    { f: fieldDialogueChangeBGDur, p: "bg.change.changeDur", t: "num" },

    { f: fieldDialogueStopBGM, p: "stopBgm", t: "bool" },
    { f: fieldDialogueStopSFX, p: "stopSfx", t: "bool" },
    { f: fieldDialogueStopVO, p: "stopVo", t: "bool" },

    { f: fieldDialoguePlayBGM, p: "bgm.key", t: "select???null" },
    { f: fieldDialoguePlaySFX, p: "sfx.key", t: "select???null" },
    { f: fieldDialoguePlayVO, p: "vo.key", t: "select???null" },

    { f: fieldDialoguePlayBGMFade, p: "bgm.fade", t: "bool" },
    { f: fieldDialoguePlayBGMFadeDur, p: "bgm.fadeDur", t: "num" },

    { f: fieldDialogueStopBGMDur, p: "stopBgmDur", t: "num" },
    { f: fieldDialogueStopSFXDur, p: "stopSfxDur", t: "num" },
    { f: fieldDialogueStopVODur, p: "stopVoDur", t: "num" },

    { f: fieldDialoguePlayBGMVolume, p: "bgm.volume", t: "clamp01" },
    { f: fieldDialoguePlaySFXVolume, p: "sfx.volume", t: "clamp01" },
    { f: fieldDialoguePlayVOVolume, p: "vo.volume", t: "clamp01" }
];

dialogueFields.forEach(({f, p, t}) => {
    switch (t) {
        case "bool": {
            f.addEventListener("click", () => {
                const entry = curScenario[curDialogue];

                setNestedProperty(entry, p, !getNestedProperty(entry, p));
                // entry[p] = !entry[p];

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            });
            break;
        }
        case "num": {
            f.addEventListener("input", () => {
                const entry = curScenario[curDialogue];

                setNestedProperty(entry, p, parseFloat(f.value));
                // entry[p] = parseFloat(f.value);

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            });
            break;
        }
        case "clamp01": {
            f.addEventListener("input", () => {
                const entry = curScenario[curDialogue];

                setNestedProperty(entry, p, clamp(parseFloat(f.value), 0, 1));
                // entry[p] = parseFloat(f.value);

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            });
            break;
        }
        case "select???null": {
            f.addEventListener("input", () => {
                const entry = curScenario[curDialogue];

                setNestedProperty(entry, p, (f.value === "???" ? null : f.value));

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            });
        }
    }
});

fieldDialogueEaseType.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.focusEaseType = fieldDialogueEaseType.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueEaseDir.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.focusEaseDir = fieldDialogueEaseDir.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueChangeBGLink.addEventListener("click", () => {
    prompt({
        title: "Load from URL",
        label: "Please input a URL to load from:",
        inputAttrs: {
            type: 'url',
            required: true
        },
        type: 'input',
        skipTaskbar: false
    })
    .then(r => {
        if (r !== null) {
            const image = r;
            const filename = path.parse(path.basename(image)).name;

            loadedBgs[filename] = image;

            const entry = curScenario[curDialogue];

            entry.bg.key = filename;

            updateDialogueList();
            selectDialogueEntry(curSelectedEntry);
        }
    })
    .catch(console.error);
});

fieldDialogueChangeBGLoad.addEventListener("input", () => {
    const fileList = fieldDialogueChangeBGLoad.files;

    if (fileList.length > 0) {
        for (const i of fileList) {
            const filer = new FileReader();
            filer.onload = (e) => {
                const image = e.target.result.toString();
                const filename = path.parse(path.basename(webUtils.getPathForFile(i))).name;

                loadedBgs[filename] = image;

                const entry = curScenario[curDialogue];

                entry.bg.key = filename;

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            }

            filer.readAsDataURL(i);
        }
    }
});

fieldDialogueChangeBGEaseType.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.bg.change.changeEase = fieldDialogueChangeBGEaseType.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueChangeBGEaseDir.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.bg.change.changeEaseDir = fieldDialogueChangeBGEaseDir.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialoguePlayBGMLink.addEventListener("click", () => {
    prompt({
        title: "Load from URL",
        label: "Please input a URL to load from:",
        inputAttrs: {
            type: 'url',
            required: true
        },
        type: 'input',
        skipTaskbar: false
    })
    .then(r => {
        if (r !== null) {
            const entry = curScenario[curDialogue];
            const audio = r;
            const filename = path.parse(path.basename(audio)).name;

            loadedBgm[filename] = audio;
            entry.bgm.key = filename;

            updateDialogueList();
            selectDialogueEntry(curSelectedEntry);
        }
    })
    .catch(console.error);
});

fieldDialoguePlayBGMLoad.addEventListener("input", () => {
    const fileList = fieldDialoguePlayBGMLoad.files;

    if (fileList.length > 0) {
        for (const i of fileList) {
            const filer = new FileReader();
            filer.onload = (e) => {
                const entry = curScenario[curDialogue];
                const audio = e.target.result.toString();
                const filename = path.parse(path.basename(webUtils.getPathForFile(i))).name;

                loadedBgm[filename] = audio;
                entry.bgm.key = filename;

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            }

            filer.readAsDataURL(i);
        }
    }
});

fieldDialoguePlaySFXLink.addEventListener("click", () => {
    prompt({
        title: "Load from URL",
        label: "Please input a URL to load from:",
        inputAttrs: {
            type: 'url',
            required: true
        },
        type: 'input',
        skipTaskbar: false
    })
    .then(r => {
        if (r !== null) {
            const entry = curScenario[curDialogue];
            const audio = r;
            const filename = path.parse(path.basename(audio)).name;

            loadedSfx[filename] = audio;
            entry.sfx.key = filename;

            updateDialogueList();
            selectDialogueEntry(curSelectedEntry);
        }
    })
    .catch(console.error);
});

fieldDialoguePlaySFXLoad.addEventListener("input", () => {
    const fileList = fieldDialoguePlaySFXLoad.files;

    if (fileList.length > 0) {
        for (const i of fileList) {
            const filer = new FileReader();
            filer.onload = (e) => {
                const entry = curScenario[curDialogue];
                const audio = e.target.result.toString();
                const filename = path.parse(path.basename(webUtils.getPathForFile(i))).name;

                loadedSfx[filename] = audio;
                entry.sfx.key = filename;

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            }

            filer.readAsDataURL(i);
        }
    }
});

fieldDialoguePlayVOLink.addEventListener("click", () => {
    prompt({
        title: "Load from URL",
        label: "Please input a URL to load from:",
        inputAttrs: {
            type: 'url',
            required: true
        },
        type: 'input',
        skipTaskbar: false
    })
    .then(r => {
        if (r !== null) {
            const entry = curScenario[curDialogue];
            const audio = r;
            const filename = path.parse(path.basename(audio)).name;

            loadedVo[filename] = audio;
            entry.vo.key = filename;

            updateDialogueList();
            selectDialogueEntry(curSelectedEntry);
        }
    })
    .catch(console.error);
});

fieldDialoguePlayVOLoad.addEventListener("input", () => {
    const fileList = fieldDialoguePlayVOLoad.files;

    if (fileList.length > 0) {
        for (const i of fileList) {
            const filer = new FileReader();
            filer.onload = (e) => {
                const entry = curScenario[curDialogue];
                const audio = e.target.result.toString();
                const filename = path.parse(path.basename(webUtils.getPathForFile(i))).name;

                loadedVo[filename] = audio;
                entry.vo.key = filename;

                updateDialogueList();
                selectDialogueEntry(curSelectedEntry);
            }

            filer.readAsDataURL(i);
        }
    }
});

fieldDialogueTLDurLock.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.timeLocked = !entry.timeLocked;

    if (entry.timeLocked) {
        entry.keyframeDuration = calcLength(entry.content);
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueTLDur.addEventListener("change", () => {
    const entry = curScenario[curDialogue];

    entry.keyframeDuration = parseFloat(fieldDialogueTLDur.value);

    if (entry.keyframeDuration < calcLength(entry.content)) {
        fieldDialogueTLDur.value = calcLength(entry.content);
        entry.keyframeDuration = calcLength(entry.content);
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueEntryJumpEyedropper.addEventListener("click", () => {
    choosingDialogueJump = true;
});

fieldDialogueEntryJumpRemove.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.jump = null;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueEntryJumpIndex.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.jump = parseInt(fieldDialogueEntryJumpIndex.value);

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldNarrationContent.addEventListener("change", () => {
    const entry = curScenario[curDialogue];

    entry.content = fieldNarrationContent.value;

    if (entry.keyframeDuration < calcLength(entry.content)) {
        entry.keyframeDuration = calcLength(entry.content);
    }

    if (entry.timeLocked) {
        entry.keyframeDuration = calcLength(entry.content);
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldMonologueContent.addEventListener("change", () => {
    const entry = curScenario[curDialogue];

    entry.content = fieldMonologueContent.value;

    if (entry.keyframeDuration < calcLength(entry.content)) {
        entry.keyframeDuration = calcLength(entry.content);
    }

    if (entry.timeLocked) {
        entry.keyframeDuration = calcLength(entry.content);
    }

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldChoiceAdd.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    if (entry.choices.length > choiceKeybinds.length) {
        popUpError("Uhh... We're out of keybinds!")
    }

    entry.choices.push({
        text: "Choice",
        style: null,
        jump: null
    });

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

function updateInspectorPanel() {
    for (const i of ["character", "world", "keyframe"]) {
        const groupName = "field-group-" + i.toLowerCase();
        const groupElement = document.getElementsByClassName(groupName);

        for (const e of groupElement) {
            e.style.display = "none";
        }
    }

    let selectedGroupName = "";

    if (curSelectedCharacter !== null) {
        selectedGroupName = "character";

        const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

        fieldCharacterVariant.innerHTML = "<option value=\"null\">Automatic</option>";
        for (const i of characters[character.id].skins) {
            const option = document.createElement("option");
            option.value = i;
            option.innerHTML = i;
            fieldCharacterVariant.appendChild(option);
        }

        fieldCharacterInitAnim.innerHTML = "<option value=\"null\">Automatic</option>";
        for (const i of characters[character.id].emotions) {
            const option = document.createElement("option");
            option.value = i;
            option.innerHTML = i;
            fieldCharacterInitAnim.appendChild(option);
        }

        fieldCharacterID.value = character.id;
        fieldCharacterName.value = character.name;
        fieldCharacterVariant.value = character.initVariant;
        fieldCharacterInitAnim.value = character.initAnimation;
        fieldCharacterInitX.value = character.initTransforms.x;
        fieldCharacterInitY.value = character.initTransforms.y;
        fieldCharacterInitR.value = character.initTransforms.rotate;
        fieldCharacterInitS.value = character.initTransforms.scale;
        fieldCharacterInitO.value = character.initTransforms.opacity;

        updateCharacterLayers(character, Object.keys(characters[character.id].layerKeys));
    } else {
        selectedGroupName = "world";

        fieldWorldScnName.value = scnName;

        fieldWorldInitCamX.value = camera.initX;
        fieldWorldInitCamY.value = camera.initY;
        fieldWorldInitCamZ.value = camera.initZ;
        fieldWorldInitCamR.value = camera.initR;

        fieldWorldInitBGX.value = bg.initX;
        fieldWorldInitBGY.value = bg.initY;
        fieldWorldInitBGS.value = bg.initS;
        fieldWorldInitBGR.value = bg.initR;

        fieldWorldInitBG.innerHTML = "";

        for (const i of Object.keys(loadedBgs)) {
            fieldWorldInitBG.innerHTML += `
            <option value="${i}">${i}</option>
            `;
        }

        fieldWorldInitBG.value = bg.initLink;
    }
    
    const selectedGroupElement = document.getElementsByClassName("field-group-" + selectedGroupName);

    for (const e of selectedGroupElement) {
        e.style.display = "";
    }
}

const fieldCharacterID = document.getElementById("field-character-charid");
const fieldCharacterName = document.getElementById("field-character-name");
const fieldCharacterVariant = document.getElementById("field-character-variant");
const fieldCharacterInitAnim = document.getElementById("field-character-initanim");
const fieldCharacterInitX = document.getElementById("field-character-initx");
const fieldCharacterInitY = document.getElementById("field-character-inity");
const fieldCharacterInitR = document.getElementById("field-character-initr");
const fieldCharacterInitS = document.getElementById("field-character-inits");
const fieldCharacterInitO = document.getElementById("field-character-inito");

const fieldCharacterLayerSearch = document.getElementById("field-character-layersearch");
const fieldCharacterLayers = document.getElementById("field-character-layers");

function updateCharacterLayers(character, arr) {
    fieldCharacterLayers.innerHTML = "";
    const characterSel = curCharacters.filter((e) => e.id === character.id)[0];

    // to do
    // keyframe system
    // test layer system exhaustively
    // blabla indicators
    // blabla system messages
    // fix some colors
    // add hover effect to clickable blabla buttons
    // fix gap on choices
    // fix choice widths
    // add pending message
    // add ambient track

    for (const i of arr) {
        const div = document.createElement("div")
        div.classList.add("generic-list-item");

        const layerName = document.createElement("input")
        layerName.setAttribute("type", "text");
        layerName.setAttribute("disabled", "");
        layerName.value = i;
        layerName.style.width = "194px"
        layerName.style.height = "32px";
        div.appendChild(layerName);

        const tray = document.createElement("div");
        tray.classList.add("button-tray");

        const color = document.createElement("input");
        color.setAttribute("type", "color");
        tray.appendChild(color);

        const alpha = document.createElement("input");
        alpha.setAttribute("type", "number");
        alpha.setAttribute("step", "0.1");
        alpha.setAttribute("min", "0");
        alpha.setAttribute("max", "1");
        alpha.style.width = "64px";
        tray.appendChild(alpha);

        const layers = characters[character.id].player.animationState.data.skeletonData.defaultSkin.attachments;
        const immut = characters[character.id].layerKeys[i];

        let colVal = rgbToHex(layers[immut][i].color.r * 255, layers[immut][i].color.g * 255, layers[immut][i].color.b * 255);
        let alpVal = layers[immut][i].color.a;

        if (Object.keys(characterSel.initLayerEdits).includes(i)) {
            colVal = characterSel.initLayerEdits[i].color;
            alpVal = characterSel.initLayerEdits[i].alpha;
        }

        color.value = colVal;
        alpha.value = alpVal;

        const hide = document.createElement("div");
        hide.classList.add("button");
        hide.classList.add("white");
        hide.innerHTML = alpVal > 0 ? `<i class='bx bx-show-alt'></i>` : `<i class='bx bx-hide'></i>`;
        tray.appendChild(hide);

        color.oninput = () => {
            if (color.value !== "#ffffff" || clamp(parseFloat(alpha.value), 0, 1) !== 1) {
                characterSel.initLayerEdits[i] = {
                    color: color.value,
                    alpha: clamp(parseFloat(alpha.value), 0, 1)
                }
            } else {
                if (Object.keys(characterSel.initLayerEdits).includes(i)) {
                    delete characterSel.initLayerEdits[i];
                }
            }

            const huh = parseFloat(alpha.value) > 0;
            hide.innerHTML = huh ? `<i class='bx bx-show-alt'></i>` : `<i class='bx bx-hide'></i>`;

            initEdits();
        }
        alpha.oninput = color.oninput;

        color.onchange = () => {
            selectDialogueEntry(curSelectedEntry);
        }
        alpha.onchange = color.onchange;

        hide.onclick = () => {
            const huh = parseFloat(alpha.value) > 0;
            alpha.value = huh ? "0" : "1";
            hide.innerHTML = huh ? `<i class='bx bx-hide'></i>` : `<i class='bx bx-show-alt'></i>`;
            
            alpha.oninput();
            alpha.onchange();
        }

        div.appendChild(tray);

        fieldCharacterLayers.appendChild(div);
    }
}

fieldCharacterLayerSearch.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const model = characters[curSelectedCharacter];

    const resultsFuzzy = fuzzysort.go(fieldCharacterLayerSearch.value, Object.keys(model.layerKeys), {all: false});
    const results = [];

    for (const i of resultsFuzzy) {
        results.push(i.target);
    }

    if (results.length > 0) {
        updateCharacterLayers(model, results);
    } else {
        updateCharacterLayers(model, Object.keys(model.layerKeys));
    }
});

fieldCharacterName.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.name = fieldCharacterName.value;

    updateCharacterList();
    selectCharacterEntry(curSelectedCharacter);
});

fieldCharacterVariant.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    if (fieldCharacterVariant.value !== "null") {
        character.initVariant = fieldCharacterVariant.value;
    } else {
        character.initVariant = null;
    }

    selectCharacterEntry(curSelectedCharacter);
    selectDialogueEntry(curSelectedEntry);
});

fieldCharacterInitAnim.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    if (fieldCharacterInitAnim.value !== "null") {
        character.initAnimation = fieldCharacterInitAnim.value;
    } else {
        character.initAnimation = null;
    }

    parseDialogue(true);
    selectCharacterEntry(curSelectedCharacter);
    selectDialogueEntry(curSelectedEntry);
});

const charInitFields = [
    { f: fieldCharacterInitX, p: "x" },
    { f: fieldCharacterInitY, p: "y" },
    { f: fieldCharacterInitS, p: "scale" },
    { f: fieldCharacterInitR, p: "rotate" },
    { f: fieldCharacterInitO, p: "opacity" },
];

charInitFields.forEach(({f, p}) => {
    f.addEventListener("input", () => {
        if (curSelectedCharacter === null) return;
        const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

        character.initTransforms[p] = parseFloat(f.value);

        selectCharacterEntry(curSelectedCharacter);
        updatePositionsToLatest();
    });
});

const worldImport = document.getElementById("world-import");
const worldExport = document.getElementById("world-export");
const worldOpen = document.getElementById("world-open");

worldImport.addEventListener("input", (e) => {
    const fileList = worldImport.files;

    if (fileList.length > 0) {
        const filer = new FileReader();
        filer.onload = (e) => {
            const loaded = JSON.parse(e.target.result.toString());

            ipcRenderer.send("load-file", webUtils.getPathForFile(fileList[0]));

            hasLoaded = false;
            fromImport = true;

            //

            scnName = loaded.name;

            camera = loaded.camera;
            bg = loaded.bg;

            loadedBgs = loaded.loadedBgs;

            loadedBgm = loaded.loadedBgm;
            loadedSfx = loaded.loadedSfx;
            loadedVo = loaded.loadedVo;

            curColorDefinitions = loaded.colorDef;
            
            for (const i of curCharacters) {
                deleteCharacter(i.id);
            }

            curCharacters = loaded.characters;

            curScenario = [];

            for (const i of loaded.scenario) {
                dialogueAdd.dispatchEvent(new Event("click"));

                const entry = curScenario[curScenario.length - 1];
                for (const j of Object.keys(i)) {
                    entry[j] = i[j]; // only apply to keys of loaded entry
                }
            }

            //

            init();
        }

        filer.readAsText(fileList[0]);
    }
});

worldExport.addEventListener("click", async () => {
    const toSave = {
        name: scnName,

        camera: camera,
        bg: bg,

        loadedBgs: loadedBgs,

        loadedBgm: loadedBgm,
        loadedSfx: loadedSfx,
        loadedVo: loadedVo,

        colorDef: curColorDefinitions,
        characters: curCharacters,
        scenario: curScenario
    }

    ipcRenderer.send("save-file", toSave);
});

worldOpen.addEventListener("click", () => {
    selectCharacterEntry(null);
});

const fieldWorldScnName = document.getElementById("field-world-scnname");

fieldWorldScnName.addEventListener("input", () => {
    scnName = fieldWorldScnName.value.trim();
});

const fieldWorldInitBG = document.getElementById("field-world-initbg");
const fieldWorldInitBGLink = document.getElementById("field-world-initbglink");
const fieldWorldInitBGLoad = document.getElementById("field-world-initbgload");

const fieldWorldInitBGX = document.getElementById("field-world-initbgx");
const fieldWorldInitBGY = document.getElementById("field-world-initbgy");
const fieldWorldInitBGS = document.getElementById("field-world-initbgs");
const fieldWorldInitBGR = document.getElementById("field-world-initbgr");

const fieldWorldInitCamX = document.getElementById("field-world-initcamx");
const fieldWorldInitCamY = document.getElementById("field-world-initcamy");
const fieldWorldInitCamZ = document.getElementById("field-world-initcamz");
const fieldWorldInitCamR = document.getElementById("field-world-initcamr");

fieldWorldInitBG.addEventListener("input", () => {
    bg.initLink = fieldWorldInitBG.value;
    updatePositionsToLatest();
});

fieldWorldInitBGLink.addEventListener("click", () => {
    prompt({
        title: "Load from URL",
        label: "Please input a URL to load from:",
        inputAttrs: {
            type: 'url',
            required: true
        },
        type: 'input',
        skipTaskbar: false
    })
    .then(r => {
        if (r !== null) {
            const image = r;
            const filename = path.parse(path.basename(image)).name;

            loadedBgs[filename] = image;
            bg.initLink = filename;

            updateInspectorPanel();
            updatePositionsToLatest();
        }
    })
    .catch(console.error);
});

fieldWorldInitBGLoad.addEventListener("input", () => {
    const fileList = fieldWorldInitBGLoad.files;

    if (fileList.length > 0) {
        for (const i of fileList) {
            const filer = new FileReader();
            filer.onload = (e) => {
                const image = e.target.result.toString();
                const filename = path.parse(path.basename(webUtils.getPathForFile(i))).name;

                loadedBgs[filename] = image;
                bg.initLink = filename;

                updateInspectorPanel();
                updatePositionsToLatest();
            }

            filer.readAsDataURL(i);
        }
    }
});

const worldInitFields = [
    { f: fieldWorldInitBGX, o: bg, p: "initX" },
    { f: fieldWorldInitBGY, o: bg, p: "initY" },
    { f: fieldWorldInitBGS, o: bg, p: "initS" },
    { f: fieldWorldInitBGR, o: bg, p: "initR" },

    { f: fieldWorldInitCamX, o: camera, p: "initX" },
    { f: fieldWorldInitCamY, o: camera, p: "initY" },
    { f: fieldWorldInitCamZ, o: camera, p: "initZ" },
    { f: fieldWorldInitCamR, o: camera, p: "initR" }
];

worldInitFields.forEach(({f, o, p}) => {
    f.addEventListener("input", () => {
        o[p] = parseFloat(f.value);
        updatePositionsToLatest();
    });
});

const timelineMain = document.getElementById("timeline-main");
const timelineBlocker = document.getElementById("timeline-blocker");
const timelineBlockerText = document.querySelector("div#timeline-blocker > span");

const fieldTimelineZoom = document.getElementById("field-timeline-zoom");
const fieldTimelineCurTime = document.getElementById("field-timeline-curtime");
const fieldTimelineMaxTime = document.getElementById("field-timeline-maxtime");

let timelineZoom = 1.0;
function updateTimelineLines() {
    timelineMain.innerHTML = "";

    if (!curScenario[curDialogue]) {
        timelineBlocker.style.display = null;
        timelineBlockerText.innerHTML = ""
        return;
    } else if (curScenario[curDialogue].type === "Choice") {
        timelineBlocker.style.display = null;
        timelineBlockerText.innerHTML = "Keyframes are unavailable for Choice type entries."
        return;
    } else {
        timelineBlocker.style.display = "none";
        timelineBlockerText.innerHTML = ""
    }

    const entry = curScenario[curDialogue];

    if (!entry.keyframeDuration || entry.keyframeDuration <= 0) return;

    let curX = 16;
    while (curX < secondsToPixel(entry.keyframeDuration, timelineZoom)) {
        const div = document.createElement("div");
        div.classList.add("timeline-line");
        div.style.left = curX + "px";

        const time = document.createElement("span");
        time.classList.add("timeline-time");
        time.style.left = curX + "px";
        time.innerHTML = formatTime(pixelsToSeconds(curX, timelineZoom));

        timelineMain.appendChild(time);
        timelineMain.appendChild(div);

        curX += PIXELS_PER_SECOND;
    }

    updateTimelinePosition();
}

const timelineLine = document.getElementById("timeline-line");
const timelineEndLine = document.getElementById("timeline-end-line");
const timelineHead = document.getElementById("timeline-head");

function updateTimelinePosition() {
    timelineLine.style.left = (16 + secondsToPixel(curDialogueCurTime, timelineZoom)) + "px";
    timelineEndLine.style.left = (16 + secondsToPixel(curDialogueMaxTime, timelineZoom)) + "px";

    fieldTimelineCurTime.value = formatTime(curDialogueCurTime);
    fieldTimelineMaxTime.value = formatTime(curDialogueMaxTime);
}

fieldTimelineZoom.addEventListener("input", () => {
    timelineZoom = parseFloat(fieldTimelineZoom.value);
    updateTimelineLines();
});

fieldTimelineCurTime.addEventListener("change", () => {

});

fieldTimelineMaxTime.addEventListener("change", () => {

});

const timelinePresent = document.getElementById("timeline-present");
const timelineZero = document.getElementById("timeline-zero");
const timelinePause = document.getElementById("timeline-pause");
const timelinePlay = document.getElementById("timeline-play");
const timelineEnd = document.getElementById("timeline-end");

const noEntriesText = [
    "There are no dialogue entries to present.",
    "... I literally have nothing to show you.",
    "I can't show you anything! Scene's empty.",
    "...",
    "You're desperately trying to get all my phrases.",
    "It's funny.",
    "You do know it's still Einkk speaking to you, right?",
    "Hellooo? Is there someone with a brain here???",
    "Helllooo????",
    "Good god. I shouldn't have made this available to the public.",
    "Oh dear...",
    "I probably should've just made this available to Sweetie...",
    "My life would be a-okay... Blame Enikk.",
    "She forced me to release it to the public.",
    "Hmmm...",
    "Wow...",
    "You're *really* persistent.",
    "Oh!",
    "Seems like I need to get back to work.",
    "Better go now! Bye bye!",
    "There are no dialogue entries to present."
];

let noEntriesTries = 0;

timelinePresent.addEventListener("click", () => {
    if (!inEditor) return;

    if (curScenario.length === 0) {
        popUpError(noEntriesText[Math.min(Math.floor(noEntriesTries / 32), noEntriesText.length - 1)]);

        noEntriesTries++;
        return;
    }

    transitionStinger();

    for (const i of tweens) {
        i.end();
    }

    curBgmKey = null;
    curSfxKey = null;
    curVoKey = null;
    curBgmPlaying.pause();
    curSfxPlaying.pause();
    curVoPlaying.pause();

    setTimeout(() => {
        dialogueMain.classList.remove("edit-mode");
        editorMain.style.display = "none";
    }, 35 * 20)

    canProgress = false;

    setTimeout(() => {
        inEditor = false;
    
        hasLoaded = false;
        init();

        curDialogue = 0;
        curDialogueCurTime = 0;
        curDialoguePlaying = true;

        canProgress = true;
    }, 40 * 20) 
});

timelineZero.addEventListener("click", () => {
    curDialogueCurTime = 0;

    curDialoguePlaying = true;
    dialogueLoop(0);
    curDialoguePlaying = false;
});

timelinePause.addEventListener("click", () => {
    // curDialogueCurTime = 0;
    curDialoguePlaying = false;
});

timelinePlay.addEventListener("click", () => {
    curDialoguePlaying = true;
});

timelineEnd.addEventListener("click", () => {
    curDialogueCurTime = curDialogueMaxTime;

    curDialoguePlaying = true;
    dialogueLoop(0);
    curDialoguePlaying = false;
});

var mouseCapture = [];
var timelineCapture = null;
var holdingTimeline = false;
timelineHead.addEventListener("pointerdown", (e) => {
    if (!curScenario[curDialogue]) return;
    if (holdingTimeline) return;
    mouseCapture[0] = e.clientX;
    mouseCapture[1] = e.clientY;

    timelineCapture = curDialogueCurTime;
    holdingTimeline = true;
    curDialoguePlaying = false;
});

document.addEventListener("pointermove", (e) => {
    if (!curScenario[curDialogue]) return;
    if (!holdingTimeline) return;

    const entry = curScenario[curDialogue];

    curDialoguePlaying = true;
    curDialogueCurTime = timelineCapture + pixelsToSeconds(e.clientX - mouseCapture[0], timelineZoom);
    curDialogueCurTime = clamp(curDialogueCurTime, 0, entry.keyframeDuration);
    dialogueLoop(0)
    curDialoguePlaying = false;

    updateTimelinePosition();
});

document.addEventListener("pointerup", (e) => {
    if (!holdingTimeline) return;

    holdingTimeline = false;
});

ipcRenderer.on("popUpError", (event, text) => {
    popUpError(text);
});

//

let tweens = [];

let bef = performance.now();
renderLoop();

function renderLoop() {
    window.requestAnimationFrame(renderLoop);

    const now = performance.now();
    const elapsed = now - bef;
    bef = now;

    if (hasLoaded) {
        dialogueLoop(elapsed / 1000);
        characterLoop(elapsed / 1000);
        cameraLoop(elapsed / 1000);
    }

    for (const i of tweens) {
        i.update();
    }
}

init();