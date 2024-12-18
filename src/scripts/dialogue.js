/*
This script handles dialogue playback and editor logic.
*/

const { Tween, Easing } = require("@tweenjs/tween.js");
const fuzzysort = require("fuzzysort");

var inEditor = true;
var hasLoaded = false;

const dialogueMain = document.getElementById("dialogue-main");
const editorMain = document.getElementById("editor-main");

const psb = new FontFace('Pretendard-SemiBold', "url('../assets/fonts/Pretendard-SemiBold.ttf')");
await psb.load();
document.fonts.add(psb);

const canvas = document.createElement("canvas");``
const ctx = canvas.getContext("2d");

const sfxType = new Audio("../assets/sounds/dialogue_type.wav");

const sfxChoiceEnter = new Audio("../assets/sounds/choice_enter.wav");
const sfxChoiceSelect = new Audio("../assets/sounds/choice_select.wav");
const sfxChoiceError = new Audio("../assets/sounds/choice_error.wav");

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
    initLink: "https://skuqre.github.io/nikke-font-generator/images/dialogue/bgs/CommanderRoom.png",
    initX: 1920 * 0.5,
    initY: 1080 * 0.5,
    initS: 1.2,
    initR: 0,
    link: "",
    x: 0,
    y: 0,
    s: 1.0,
    r: 0
}
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
                    if (characterModel.emotion !== entry.speakerModelEmotion && entry.speakerModelEmotion !== null) {
                        characterModel.player.playAnimationWithTrack(0, entry.speakerModelEmotion, true);
                        characterModel.emotion = entry.speakerModelEmotion;
                    }

                    characterModel.player.playAnimationWithTrack(1, "talk_start", true);
                    characterModel.talking = true;
                }
            }
        
            curDialogueCurTime = 0.0;
            curDialoguePlaying = true;

            break;
        case "choice":
            dialogueContainerChoice.style.opacity = "1";
            dialogueGradientChoice.style.opacity = "1";

            if (!inEditor) {
                sfxChoiceEnter.play();
            }

            curDialogueChoices = [];

            for (let i = 0; i < entry.choices.length; i++) {
                const choice = entry.choices[i];
                addChoice(choice.text, choice.jump);
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
    const lettersToDisplay = clamp(Math.floor(curDialogueCurTime / (4 / 60)), 0, curDialogueContent.length);

    if (prev !== lettersToDisplay && !["narration", "monologue", "choice"].includes(curDialogueState)) {
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
function addChoice(choice = "", jumpTo = null) {
    curDialogueChoices.push({
        text: choice,
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

        main.onmousedown = (e) => {
            choiceCommonPress(span.parentElement); // ???
        }

        main.onmouseup = (e) => {
            choiceCommonRelease(span.parentElement);

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
        curDialogue = entry.jump - 1;
    }

    skipOrProgress();
}

/**
 * Measure text with choice styles. Used to differentiate single line choices and multiline choices.
 * @param { String } text 
 */
function choiceMeasureText(text) {
    ctx.font = "21px Pretendard-SemiBold";
    ctx.letterSpacing = "0.3px";
    return getLinesForParagraphs(ctx, text, 468 - 34);
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
                characters[i].player.playAnimationWithTrack(1, 'talk_end', false);
                characters[i].player.queueNextEmpty(1, 4 / 60);
                characters[i].player.animationState.setEmptyAnimation(1, 4/60);
                characters[i].talking = false;
            }

            // end all tweens
            for (const i of tweens) {
                i.end();
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

                    curDialogue++;
                    parseDialogue();
                })
                .start();
            tweens.push(tween);
        } else {
            curDialogue++;
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

                    characters[curScenario[curDialogue].speakerModel].player.playAnimationWithTrack(1, 'talk_end', false);
                    characters[curScenario[curDialogue].speakerModel].player.queueNextEmpty(1, 4 / 60);
                    characters[curScenario[curDialogue].speakerModel].talking = false;
                }
            }
        }
    }

    if (curScenario.length > 0 && !inEditor && curScenarioAuto) {
        if (curScenario[curDialogue].type !== "Choice") {
            // these all have to be true to be considered "done"
            const conditionsToBeDone = [
                curDialogueCurTime >= curDialogueMaxTime,
                tweens.length === 0,
                // todo: audio file playing
            ];
        
            if (!conditionsToBeDone.includes(false)) {
                if (autoTimer === null) {
                    autoTimer = setTimeout(() => {
                        skipOrProgress();
                        autoTimer = null;
                    }, 1500);
                }
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
        backgroundMain.src = curBgLink;
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

            initPositions();

            hasLoaded = true;
            loadingScreen.style.display = "none";

            clearInterval(loadInterval);
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

    if (e.key.toLowerCase() === "h") {
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
                break;
            }
            case "delete": {
                dialogueDel.dispatchEvent(new Event("click"));
                break;
            }
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
            if (choosingJump) {
                selectJumpForChoice(curEntries.indexOf(div));
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
    }

    curEntries[curSelectedEntry].querySelector("div.select-highlight").style.display = "block";

    // stop all talking models
    for (const i of Object.keys(characters)) {
        if (!characters[i].talking) continue;
        characters[i].player.playAnimationWithTrack(1, 'talk_end', false);
        characters[i].player.queueNextEmpty(1, 4 / 60);
        characters[i].talking = false;
    }

    // end all tweens
    for (const i of tweens) {
        i.end();
    }

    for (let i = 0; i < curSelectedEntry; i++) {
        curDialogue = i;
        parseDialogue(true);
        
        if (curDialogueState !== "choice" && curScenario[curDialogue].content.trim().length > 0) {
            skipOrProgress();
        }
    }

    curDialogue = curSelectedEntry;
    parseDialogue();

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

    	content: "",
    	keyframes: [],
        keyframeDuration: null,
    	time: null,
    	choices: null
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

        const button = document.createElement("div");
        button.classList.add("button");
        button.classList.add("green");
        button.innerHTML = `<i class="bx bx-plus"></i>`;

        button.onclick = async () => {
            if (button.getAttribute("active") == "false") return;
            modelsAdding += 1;

            button.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
            button.setAttribute("active", false);

            const req = await fetch("https://nkas-l2d.pages.dev/characters/" + invertedModels[immut] + "/idle/data.json");
            const json = await req.json();

            const dupes = curCharacters.filter(e => e.id.startsWith(invertedModels[immut]));

            curCharacters.push({
                id: invertedModels[immut] + (dupes.length > 0 ? "_" + dupes.length : ""),
                type: "character",
                name: immut,
                ver: json.ver,
                initAnimation: "idle",
                initVariant: null,
                initTransforms: {
                    x: 1920 * 0.5,
                    y: 1080 * 0.9,
                    rotate: 0,
                    scale: 1,
                    opacity: 1
                },
                customPath: "https://nkas-l2d.pages.dev/characters/" + invertedModels[immut] + "/idle/" + invertedModels[immut]
            });

            button.innerHTML = `<i class="bx bx-plus"></i>`;
            button.setAttribute("active", true);

            modelsAdding -= 1;
        }

        tray.appendChild(button);
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

    deleteCharacter(curSelectedCharacter);
    curCharacters = curCharacters.filter((e) => e.id !== curSelectedCharacter);

    updateCharacterList();
    selectCharacterEntry(null); 
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

const editorList = document.getElementById("editor-edit-list");
const editorInst = document.getElementById("editor-edit-inst");

const fieldDialogueType = document.getElementById("field-dialogue-type");

const fieldDialogueName = document.getElementById("field-dialogue-name");
const fieldDialogueContent = document.getElementById("field-dialogue-content");
const fieldDialogueCharacter = document.getElementById("field-dialogue-charid");
const fieldDialogueEmotion = document.getElementById("field-dialogue-emotion");
const fieldDialogueMatchInit = document.getElementById("field-dialogue-matchinit");

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

const fieldDialogueTLDur = document.getElementById("field-dialogue-tldur");

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

    fieldDialogueFocusX.innerHTML = entry.focusX ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusY.innerHTML = entry.focusY ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusZ.innerHTML = entry.focusZ ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusR.innerHTML = entry.focusR ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFocusPosX.value = entry.focusPosX;
    fieldDialogueFocusPosY.value = entry.focusPosY;
    fieldDialogueFocusPosZ.value = entry.focusZoom;
    fieldDialogueFocusPosR.value = entry.focusRot;
    fieldDialogueFocusDur.value = entry.focusDur !== null ? entry.focusDur : 1;

    fieldDialogueFadeIn.innerHTML = entry.fadeIn ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFadeOut.innerHTML = entry.fadeOut ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFadeBlack.innerHTML = entry.fadeToBlack ? "<i class='bx bx-check'></i>" : "";
    fieldDialogueFadeInDur.value = entry.fadeInDur;
    fieldDialogueFadeOutDur.value = entry.fadeOutDur;
    fieldDialogueFadeBlackDur.value = entry.fadeBlackDur;

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

    const num = Math.max(entry.keyframeDuration, calcLength(entry.content));
    fieldDialogueTLDur.value = num;

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
            } else {
                fieldDialogueEmotion.innerHTML = "<option selected value=\"none\">No model selected</option>";

                fieldDialogueEmotion.setAttribute("disabled", "");
                fieldDialogueMatchInit.setAttribute("disabled", "");
            }
            break;
        case "Choice":
            fieldChoiceList.innerHTML = "";

            for (const i of entry.choices) {
                const div = document.createElement("div")
                div.classList.add("generic-list-item");
        
                const choiceText = document.createElement("textarea")
                choiceText.value = i.text;
                choiceText.style.height = "32px";
                div.appendChild(choiceText);

                const immut = entry.choices.indexOf(i);
        
                choiceText.onchange = () => {
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
                changeJump.title = "Change the index the choice will jump to, akin to an eyedropper."
                tray.appendChild(changeJump)

                const jumpLocation = document.createElement("input");
                jumpLocation.setAttribute("type", "number");
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
                    choosingJump = true;
                    choiceEditing = immut;
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

let choosingJump = false;
let choiceEditing = null;

function selectJumpForChoice(jumpIndex) {
    if (choiceEditing === null) return;

    const entry = curScenario[curDialogue];

    entry.choices[choiceEditing].jump = jumpIndex;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);

    choosingJump = false;
    choiceEditing = null;
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
            // entry.choices = null;

            if (entry.speaker === null)
                entry.speaker = "";
            if (entry.speakerModel === null)
                entry.speaker = null;
            if (entry.speakerModelEmotion === null)
                entry.speakerModelEmotion = null;
            if (entry.content === null)
                entry.content = "";

            break;
        case "Choice":
            if (entry.choices === null)
                entry.choices = [];

            // entry.speaker = null;
            // entry.speakerModel = null;
            // entry.speakerModelEmotion = null;
            // entry.content = null;

            break;
        case "Monologue":
        case "Narration":
            if (entry.content === null)
                entry.content = "";

            // entry.choices = null;
            // entry.speaker = null;
            // entry.speakerModel = null;
            // entry.speakerModelEmotion = null;
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

fieldDialogueFocusX.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.focusX = !entry.focusX;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusY.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.focusY = !entry.focusY;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusZ.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.focusZ = !entry.focusZ;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusR.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.focusR = !entry.focusR;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusPosX.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.focusPosX = parseFloat(fieldDialogueFocusPosX.value);

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusPosY.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.focusPosY = parseFloat(fieldDialogueFocusPosY.value);

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusPosZ.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.focusZoom = parseFloat(fieldDialogueFocusPosZ.value);

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusPosR.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.focusRot = parseFloat(fieldDialogueFocusPosR.value);

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFocusDur.addEventListener("change", () => {
    const entry = curScenario[curDialogue];

    entry.focusDur = parseFloat(fieldDialogueFocusDur.value);

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
})

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

fieldDialogueFadeIn.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.fadeIn = !entry.fadeIn;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFadeOut.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.fadeOut = !entry.fadeOut;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFadeBlack.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.fadeToBlack = !entry.fadeToBlack;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFadeInDur.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.fadeInDur = fieldDialogueFadeInDur.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFadeOutDur.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.fadeOutDur = fieldDialogueFadeOutDur.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueFadeBlackDur.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.fadeBlackDur = fieldDialogueFadeBlackDur.value;

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

fieldNarrationContent.addEventListener("change", () => {
    const entry = curScenario[curDialogue];

    entry.content = fieldNarrationContent.value;

    if (entry.keyframeDuration < calcLength(entry.content)) {
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

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldChoiceAdd.addEventListener("click", () => {
    const entry = curScenario[curDialogue];

    entry.choices.push({
        text: "Choice",
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
    } else {
        selectedGroupName = "world";

        fieldWorldInitCamX.value = camera.initX;
        fieldWorldInitCamY.value = camera.initY;
        fieldWorldInitCamZ.value = camera.initZ;
        fieldWorldInitCamR.value = camera.initR;

        fieldWorldInitBGX.value = bg.initX;
        fieldWorldInitBGY.value = bg.initY;
        fieldWorldInitBGS.value = bg.initS;
        fieldWorldInitBGR.value = bg.initR;
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

fieldCharacterInitX.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.x = parseFloat(fieldCharacterInitX.value);

    selectCharacterEntry(curSelectedCharacter);
    updatePositionsToLatest();
});

fieldCharacterInitY.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.y = parseFloat(fieldCharacterInitY.value);

    selectCharacterEntry(curSelectedCharacter);
    updatePositionsToLatest();
});

fieldCharacterInitR.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.rotate = parseFloat(fieldCharacterInitR.value);

    selectCharacterEntry(curSelectedCharacter);
    updatePositionsToLatest();
});

fieldCharacterInitS.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.scale = parseFloat(fieldCharacterInitS.value);

    selectCharacterEntry(curSelectedCharacter);
    updatePositionsToLatest();
});

fieldCharacterInitO.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.opacity = parseFloat(fieldCharacterInitO.value);

    selectCharacterEntry(curSelectedCharacter);
    updatePositionsToLatest();
});

const worldOpen = document.getElementById("world-open");

worldOpen.addEventListener("click", () => {
    selectCharacterEntry(null);
});

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

fieldWorldInitBGLink.addEventListener("input", () => {
    bg.initLink = fieldWorldInitBGLink.value.trim();
    updatePositionsToLatest();
});

fieldWorldInitBGLoad.addEventListener("input", () => {
    
});

fieldWorldInitBGX.addEventListener("input", () => {
    bg.initX = parseFloat(fieldWorldInitBGX.value);
    updatePositionsToLatest();
});

fieldWorldInitBGY.addEventListener("input", () => {
    bg.initY = parseFloat(fieldWorldInitBGY.value);
    updatePositionsToLatest();
});

fieldWorldInitBGS.addEventListener("input", () => {
    bg.initS = parseFloat(fieldWorldInitBGS.value);
    updatePositionsToLatest();
});

fieldWorldInitBGR.addEventListener("input", () => {
    bg.initR = parseFloat(fieldWorldInitBGR.value);
    updatePositionsToLatest();
});

fieldWorldInitCamX.addEventListener("input", () => {
    camera.initX = parseFloat(fieldWorldInitCamX.value);
    updatePositionsToLatest();
});

fieldWorldInitCamY.addEventListener("input", () => {
    camera.initY = parseFloat(fieldWorldInitCamY.value);
    updatePositionsToLatest();
});

fieldWorldInitCamZ.addEventListener("input", () => {
    camera.initZ = parseFloat(fieldWorldInitCamZ.value);
    updatePositionsToLatest();
});

fieldWorldInitCamR.addEventListener("input", () => {
    camera.initR = parseFloat(fieldWorldInitCamR.value);
    updatePositionsToLatest();
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

timelinePresent.addEventListener("click", () => {
    if (!inEditor) return;

    if (curScenario.length === 0) {
        popUpError("There are no dialogue entries to present.")
        return;
    }

    transitionStinger();

    for (const i of tweens) {
        i.end();
    }

    setTimeout(() => {
        dialogueMain.classList.remove("edit-mode");
        editorMain.style.display = "none";
    }, 35 * 20)

    setTimeout(() => {
        inEditor = false;
    
        hasLoaded = false;
        init();

        curDialogue = 0;
        curDialogueCurTime = 0;
        curDialoguePlaying = true;
    }, 40 * 20) 
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
})

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