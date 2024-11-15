/*
This script handles dialogue playback and editor logic.
*/

const { Tween, Easing } = require("@tweenjs/tween.js");

var inEditor = true;
var hasLoaded = false;

const psb = new FontFace('Pretendard-SemiBold', "url('../assets/fonts/Pretendard-SemiBold.ttf')");
await psb.load();
document.fonts.add(psb);

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

var camera = {
    initX: 1920 * 0.125,
    initY: 1080 * 0.5,
    x: 0,
    y: 0,
    z: 1.0,
    r: 0
}
var curColorDefinitions = {
    "Anis": "#f5ba36",
    "Rapi": "#ff0000",
    "Neon": "#0000ff"
}
var curCharacters = [
    {
        id: "c011",
        type: "character",
        name: "Neon",
        ver: 4.0,
        initAnimation: "idle",
        initVariant: null,
        initTransforms: {
            x: 1920 * (0.525 + 0.3),
            y: 1080 * 0.95,
            rotate: 0,
            scale: 1,
            opacity: 1
        },
        customPath: "https://nikke-db-legacy.pages.dev/l2d/c011/c011_00"
    },
    {
        id: "c010",
        type: "character",
        name: "Rapi",
        ver: 4.0,
        initAnimation: "idle",
        initVariant: null,
        initTransforms: {
            x: 1920 * (0.525 - 0.4),
            y: 1080 * 0.95,
            rotate: 0,
            scale: 1,
            opacity: 1
        },
        customPath: "https://nikke-db-legacy.pages.dev/l2d/c010/c010_00"
    },
    {
        id: "c012",
        type: "character",
        name: "Anis",
        ver: 4.0,
        initAnimation: "idle",
        initVariant: null,
        initTransforms: {
            x: 1920 * 0.525,
            y: 1080 * 0.95,
            rotate: 0,
            scale: 1,
            opacity: 1
        },
        customPath: "https://nikke-db-legacy.pages.dev/l2d/c012/c012_00"
    },
]
var curScenario = [
    {
    	"type": "Speech",
    	"speaker": "Rapi",
        "speakerModel": "c010",
        "speakerModelEmotion": "idle",
        "focusX": true,
        "focusY": false,
    	"content": "I want a cheeseburger.",
    	"keyframes": [],
    	"time": null,
    	"choices": null
    },
    {
    	"type": "Speech",
    	"speaker": "Anis",
        "speakerModel": "c012",
        "speakerModelEmotion": "idle",
        "focusX": true,
        "focusY": false,
    	"content": "Me too.",
    	"keyframes": [],
    	"time": null,
    	"choices": null
    },
    {
    	"type": "Speech",
    	"speaker": "Neon",
        "speakerModel": "c011",
        "speakerModelEmotion": "idle",
        "focusX": true,
        "focusY": false,
    	"content": "Me three.",
    	"keyframes": [],
    	"time": null,
    	"choices": null
    }
];
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

var dialogueDecoPointer = document.getElementById("dialogue-deco-pointer");
var dialogueDecoMesh = document.getElementById("dialogue-deco-mesh");

var dialogueContainerSpeech = document.getElementById("dialogue-container-speech");
var dialogueContainerChoice = document.getElementById("dialogue-container-choices");
var dialogueContainerNarration = document.getElementById("dialogue-container-narration");
var dialogueGradientChoice = document.getElementById("gdc");
var dialogueGradientSpeech = document.getElementById("gds");

var layerDialogue = document.getElementById("layer-dialogue");
var layerControls = document.getElementById("layer-controls");

var layerBackground = document.getElementById("layer-background");
var layerCharacter = document.getElementById("layer-character");

function parseDialogue(noTalk = false) {
    if (curDialogue > curScenario.length - 1) return; // quit
    if (curDialogue === 0) {
        initPositions();
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

            // set emotion (and make model talk)
            if (entry.speakerModel !== null) {
                if (!(entry.speakerModel in characters)) return;

                if (!noTalk) {
                    if (characters[entry.speakerModel].emotion !== entry.speakerModelEmotion) {
                        characters[entry.speakerModel].player.playAnimationWithTrack(0, entry.speakerModelEmotion, true);
                        characters[entry.speakerModel].emotion = entry.speakerModelEmotion;
                    }

                    characters[entry.speakerModel].player.playAnimationWithTrack(1, "talk_start", true);
                    characters[entry.speakerModel].talking = true;
                }

                if (entry.focusX || entry.focusY) {
                    const tween = new Tween(camera)
                        .to({
                            x: entry.focusX ? characters[entry.speakerModel].transforms.x : camera.x,
                            y: entry.focusY ? characters[entry.speakerModel].transforms.y : camera.y,
                        }, 1000)
                        .easing(Easing.Sinusoidal.InOut)
                        .start()
                    tweens.push(tween);
                }
            }
        
            curDialogueCurTime = 0.0;
            curDialoguePlaying = true;

            break;
        case "choice":
            dialogueContainerChoice.style.opacity = "1";
            dialogueGradientChoice.style.opacity = "1";

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

            break;
    }

    if (skipNext) {
        curDialogueCurTime = curDialogueMaxTime;
        skipNext = false;
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

function controlCommonPress(parentElement) {
    parentElement.style.scale = "0.95";
    parentElement.style.filter = "brightness(40%)";
}

function controlCommonRelease(parentElement) {
    parentElement.style.scale = "1";
    parentElement.style.filter = "brightness(100%)";
}

var skipNext = false;

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

function updateText() {
    console.log("NOTHING IS SUPPOSED TO FUCK WITH YOU BUT YOU ARE DOING IT SO WHAT THE FUCK IS WRONG???");
    const lettersToDisplay = clamp(Math.floor(curDialogueCurTime / (4 / 60)), 0, curDialogueContent.length);

    for (let i = 0; i < curDialogueContent.length; i++) {
        curDialogueContent[i].style.opacity = "0";
    }

    for (let i = 0; i < lettersToDisplay; i++) {
        curDialogueContent[i].style.opacity = "1";
    }
}

/**
 * Adds a choice.
 * @param { String } choice 
 * @param { Int } jumpTo 
 */
function addChoice(choice = "", jumpTo = null) {
    curDialogueChoices.push({
        text: choice,
        jumpTo: jumpTo
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
    if (entry.jump ?? false) {

    } else {
        curDialogueCurTime = curDialogueMaxTime;
        curDialoguePlaying = false;
        skipOrProgress();
    }
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
function skipOrProgress() {
    if (curDialogueCurTime < curDialogueMaxTime) {
        if (curDialoguePlaying) {
            curDialogueCurTime = curDialogueMaxTime;

            // stop all talking models
            for (const i of Object.keys(characters)) {
                if (!characters[i].talking) continue;
                characters[i].player.playAnimationWithTrack(1, 'talk_end', true);
                characters[i].player.queueNextEmpty(1, 4 / 60);
                characters[i].talking = false;
            }

            // end all tweens
            for (const i of tweens) {
                i.end();
                tweens.splice(0, 1);
            }
        }
    } else {
        curDialogue++;
        parseDialogue();
    }
}

/**
 * Main update loop function
 * @param { Float } elapsed 
 */
function dialogueLoop(elapsed) {
    if (curDialoguePlaying) {
        if (curDialogueCurTime < curDialogueMaxTime) {
            curDialogueCurTime += elapsed;
            updateText();
        } else {
            curDialogueCurTime = curDialogueMaxTime;
            curDialoguePlaying = false;
            updateText();

            if (curScenario[curDialogue].type === "Speech") {
                if (curScenario[curDialogue].speakerModel !== null) {
                    if (!(curScenario[curDialogue].speakerModel in characters)) return;
                    if (!characters[curScenario[curDialogue].speakerModel].talking) return;

                    characters[curScenario[curDialogue].speakerModel].player.playAnimationWithTrack(1, 'talk_end', true);
                    characters[curScenario[curDialogue].speakerModel].player.queueNextEmpty(1, 4 / 60);
                    characters[curScenario[curDialogue].speakerModel].talking = false;
                }
            }

            if (curScenario[curDialogue].type === "Speech" ||
                curScenario[curDialogue].type === "Narration" ||
                curScenario[curDialogue].type === "Monologue") {
                dialogueDecoPointer.style.opacity = "1";
                dialogueDecoPointer.style.animation = "0.8s infinite pointer cubic-bezier(0.37, 0, 0.63, 1)";
            }
        }
    }
}

/**
 * camera update
 */
function cameraLoop(elapsed) {
    layerBackground.style.left = 1920 * 0.5 + ((1920 * 0.5 - camera.x) * 0.1) + "px";
    layerBackground.style.top = 1080 * 0.5 + ((1080 * 0.5 - camera.y) * 0.1) + "px";
    layerCharacter.style.left = (1920 * 0.5 - camera.x) + "px";
    layerCharacter.style.top = (1080 * 0.5 - camera.y) + "px";
}

/**
 * Init
 */
function init() {

    for (const i of curCharacters) {
        createCharacter(i.id, i.ver, i.initAnimation, i.initTransforms.x, i.initTransforms.y, null, i.customPath);
    }

    let charsLoaded = Object.values(characters).filter(a => a.loaded);

    const loadInterval = setInterval(() => {
        charsLoaded = Object.values(characters).filter(a => a.loaded);
        if (charsLoaded.length === Object.values(characters).length) {
            parseDialogue();

            updateDialogueList();
            selectDialogueEntry(0);

            updateCharacterList();
            selectCharacterEntry(null);

            initPositions();

            hasLoaded = true;

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

    // initialize character positions
    for (const i of curCharacters) {
        characters[i.id].transforms.x = i.initTransforms.x;
        characters[i.id].transforms.y = i.initTransforms.y;
        characters[i.id].transforms.rotate = i.initTransforms.rotate;
        characters[i.id].transforms.scale = i.initTransforms.scale;
        characters[i.id].transforms.opacity = i.initTransforms.opacity;

        const skin = i.initVariant !== null ? i.initVariant : characters[i.id].skins[0];
        characters[i.id].player.skeleton.setSkinByName(skin);
    }
}

function updatePositionsToLatest() {
    for (let i = 0; i < curSelectedEntry + 1; i++) {
        curDialogue = i;
        parseDialogue(true);

        for (const i of tweens) {
            i.end();
            tweens.splice(0, 1);
        }
        
        if (curDialogueState !== "choice" && curScenario[curDialogue].content.trim().length > 0) {
            skipOrProgress();
        }
    }
}

window.addEventListener("keydown", (e) => {
    if (inEditor) return;
    if (!curScenarioShown) return;
    if (curDialogueChoiceElements.length > 0) return;

    if (e.key === " ") {
        skipOrProgress();
    }
    if (e.key.toLowerCase() === "h") {
        controlHide.onclick();
    }
});

window.addEventListener("click", (e) => {
    if (inEditor) return;
    if (!curScenarioShown) return;
    if (curDialogueChoiceElements.length > 0) return;
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

var curSelectedCharacter = null;
var curCharEntries = [];

const editorDialogueList = document.getElementById("editor-dialogue-list");
const editorCharacterList = document.getElementById("editor-character-list");

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
            case "Speech":
                speaker = i.speaker;
                content = i.content;
                iconclass = "bx bxs-message-dots";
                break;
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
        }

        const icon = document.createElement("i");
        for (const i of iconclass.split(" ")) {
            icon.classList.add(i);
        }
        icon.style.color = "white";
        if (i.speaker in curColorDefinitions) {
            icon.style.color = curColorDefinitions[i.speaker];
        }
        div.appendChild(icon);
        
        const span = document.createElement("span");
        span.innerHTML = (!["Monologue", "Narration", "Choice"].includes(i.type) ? `<b>${speaker}</b>: ` : "") + `${content}`;
        div.appendChild(span);

        const highlight = document.createElement("div");
        highlight.classList.add("select-highlight");
        highlight.style.display = "none";
        div.appendChild(highlight);

        editorDialogueList.appendChild(div);

        curEntries.push(div);

        div.onclick = () => {
            selectDialogueEntry(curEntries.indexOf(div));
        }
    }
}

function selectDialogueEntry(to) {
    curSelectedEntry = to;

    for (const i of curEntries) {
        i.querySelector("div.select-highlight").style.display = "none";
    }

    curEntries[curSelectedEntry].querySelector("div.select-highlight").style.display = "block";

    // stop all talking models
    for (const i of Object.keys(characters)) {
        if (!characters[i].talking) continue;
        characters[i].player.playAnimationWithTrack(1, 'talk_end', true);
        characters[i].player.queueNextEmpty(1, 4 / 60);
        characters[i].talking = false;
    }

    // end all tweens
    for (const i of tweens) {
        i.end();
        tweens.splice(0, 1);
    }

    for (let i = 0; i < curSelectedEntry; i++) {
        curDialogue = i;
        parseDialogue();
        
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
}

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

const fieldDialogueType = document.getElementById("field-dialogue-type");

const fieldDialogueName = document.getElementById("field-dialogue-name");
const fieldDialogueContent = document.getElementById("field-dialogue-content");
const fieldDialogueCharacter = document.getElementById("field-dialogue-charid");
const fieldDialogueEmotion = document.getElementById("field-dialogue-emotion");

const fieldDialogueFocusX = document.getElementById("field-dialogue-focx");
const fieldDialogueFocusY = document.getElementById("field-dialogue-focy");

const fieldNarrationContent = document.getElementById("field-dialogue-ncontent");
const fieldMonologueContent = document.getElementById("field-dialogue-mcontent");

function updateEditPanel() {
    const entry = curScenario[curDialogue];

    fieldDialogueType.value = entry.type;

    for (const i of fieldDialogueType.options) {
        const groupName = "field-group-" + i.value.toLowerCase();
        const groupElement = document.getElementsByClassName(groupName);

        for (const e of groupElement) {
            e.style.display = "none";
        }
    }

    const selectedGroupName = fieldDialogueType.value.toLowerCase();
    const selectedGroupElement = document.getElementsByClassName("field-group-" + selectedGroupName);

    for (const e of selectedGroupElement) {
        e.style.display = "";
    }

    switch (entry.type) {
        case "Speech":
            fieldDialogueName.value = entry.speaker;
            fieldDialogueContent.value = entry.content;

            fieldDialogueCharacter.innerHTML = "";
            for (const i of curCharacters) {
                const option = document.createElement("option");
                option.value = i.id;
                option.innerHTML = `${i.name} (${i.id})`;
                fieldDialogueCharacter.appendChild(option);
            }
            fieldDialogueCharacter.value = entry.speakerModel;

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
            
            fieldDialogueFocusX.innerHTML = entry.focusX ? "<i class='bx bx-check'></i>" : "";
            fieldDialogueFocusY.innerHTML = entry.focusY ? "<i class='bx bx-check'></i>" : "";

            break;
        case "Choice":
            break
        case "Narration":
            fieldNarrationContent.value = entry.content;
            break;
        case "Monologue":
            fieldMonologueContent.value = entry.content;
            break;
    }
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
                entry.speaker = "";
            if (entry.speakerModelEmotion === null)
                entry.speakerModelEmotion = "";
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

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueCharacter.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.speakerModel = fieldDialogueCharacter.value;

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

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldDialogueEmotion.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.speakerModelEmotion = fieldDialogueEmotion.value;

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

fieldNarrationContent.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.content = fieldNarrationContent.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

fieldMonologueContent.addEventListener("input", () => {
    const entry = curScenario[curDialogue];

    entry.content = fieldMonologueContent.value;

    updateDialogueList();
    selectDialogueEntry(curSelectedEntry);
});

const fieldCharacterID = document.getElementById("field-character-charid");
const fieldCharacterName = document.getElementById("field-character-name");
const fieldCharacterVariant = document.getElementById("field-character-variant");
const fieldCharacterInitX = document.getElementById("field-character-initx");
const fieldCharacterInitY = document.getElementById("field-character-inity");
const fieldCharacterInitR = document.getElementById("field-character-initr");
const fieldCharacterInitS = document.getElementById("field-character-inits");
const fieldCharacterInitO = document.getElementById("field-character-inito");

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

        fieldCharacterID.value = character.id;
        fieldCharacterName.value = character.name;
        fieldCharacterVariant.value = character.initVariant;
        fieldCharacterInitX.value = character.initTransforms.x;
        fieldCharacterInitY.value = character.initTransforms.y;
        fieldCharacterInitR.value = character.initTransforms.rotate;
        fieldCharacterInitS.value = character.initTransforms.scale;
        fieldCharacterInitO.value = character.initTransforms.opacity;
    } else {
        selectedGroupName = "world";
    }
    
    const selectedGroupElement = document.getElementsByClassName("field-group-" + selectedGroupName);

    for (const e of selectedGroupElement) {
        e.style.display = "";
    }
}

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

    updateCharacterList();
    selectCharacterEntry(curSelectedCharacter);
    selectDialogueEntry(curSelectedEntry);
});

fieldCharacterInitX.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.x = parseInt(fieldCharacterInitX.value);

    selectCharacterEntry(curSelectedCharacter);
    updatePositionsToLatest();
});

fieldCharacterInitY.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.y = parseInt(fieldCharacterInitY.value);

    selectCharacterEntry(curSelectedCharacter);
    updatePositionsToLatest();
});

fieldCharacterInitR.addEventListener("input", () => {
    if (curSelectedCharacter === null) return;
    const character = curCharacters.filter((e) => e.id === curSelectedCharacter)[0];

    character.initTransforms.rotate = parseInt(fieldCharacterInitR.value);

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