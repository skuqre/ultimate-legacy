/*
This script handles dialogue playback.
*/

var inEditor = false;

const psb = new FontFace('Pretendard-SemiBold', "url('../assets/fonts/Pretendard-SemiBold.ttf')");
await psb.load();
document.fonts.add(psb);

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

var curColorDefinitions = {
    "Anis": "#f5ba36"
}

var curScenario = [
    // {
    // 	"type": "Speech",
    // 	"speaker": "Anis",
    //     "speakerModel": "c012",
    //     "speakerModelEmotion": "void",
    // 	"content": "Hey Commander,",
    // 	"keyframes": [],
    // 	"time": null,
    // 	"choices": null
    // },
    {
    	"type": "Speech",
    	"speaker": "Anis",
        "speakerModel": "c012",
        "speakerModelEmotion": "no",
    	"content": "You might have an issue.",
    	"keyframes": [],
    	"time": null,
    	"choices": null
    },
    {
    	"type": "Monologue",
    	"speaker": "Anis",
        "speakerModel": "c012",
        "speakerModelEmotion": "no",
    	"content": "Bang!",
    	"keyframes": [],
    	"time": null,
    	"choices": null
    },
    {
    	"type": "Narration",
    	"speaker": "Anis",
        "speakerModel": "c012",
        "speakerModelEmotion": "no",
    	"content": "*Bang!*",
    	"keyframes": [],
    	"time": null,
    	"choices": null
    },
    // {
    //     "type": "Choice",
    //     "speaker": null,
    //     "speakerModel": null,
    //     "speakerModelEmotion": null,
    //     "content": null,
    //     "keyframes": [],
    //     "time": null,
    //     "choices": [
    //         {
    //             "text": "Single line choice",
    //             "jump": null
    //         },
    //         {
    //             "text": "Double line choice Double line choice Double line choice Double line choice",
    //             "jump": null
    //         },
    //         {
    //             "text": "Triple line choice Triple line choice Triple line choice Triple line choice Triple line choice Triple line choice",
    //             "jump": null
    //         }
    //     ]
    // },
    // {
    //     "type": "Choice",
    //     "speaker": null,
    //     "speakerModel": null,
    //     "speakerModelEmotion": null,
    //     "content": null,
    //     "keyframes": [],
    //     "time": null,
    //     "choices": [
    //         {
    //             "text": "They can literally be anything.",
    //             "jump": null
    //         }
    //     ]
    // },
    // {
    //     "type": "Choice",
    //     "speaker": null,
    //     "speakerModel": null,
    //     "speakerModelEmotion": null,
    //     "content": null,
    //     "keyframes": [],
    //     "time": null,
    //     "choices": [
    //         {
    //             "text": "Fries, mashed potatoes, food for stew...",
    //             "jump": null
    //         }
    //     ]
    // },
    // {
    //     "type": "Choice",
    //     "speaker": null,
    //     "speakerModel": null,
    //     "speakerModelEmotion": null,
    //     "content": null,
    //     "keyframes": [],
    //     "time": null,
    //     "choices": [
    //         {
    //             "text": "You name it.",
    //             "jump": null
    //         }
    //     ]
    // },
    // {
    // 	"type": "Speech",
    // 	"speaker": "Anis",
    //     "speakerModel": "c012",
    //     "speakerModelEmotion": "void",
    // 	"content": "...and that's another one to the list...",
    // 	"keyframes": [],
    // 	"time": null,
    // 	"choices": null
    // },
    // {
    // 	"type": "Speech",
    // 	"speaker": "Anis",
    //     "speakerModel": "c012",
    //     "speakerModelEmotion": "idle",
    // 	"content": "Oh, huh?",
    // 	"keyframes": [],
    // 	"time": null,
    // 	"choices": null
    // },
    // {
    // 	"type": "Speech",
    // 	"speaker": "Anis",
    //     "speakerModel": "c012",
    //     "speakerModelEmotion": "worry",
    // 	"content": "We were thinking of what to supplies to buy and we were unsure whether to buy potatoes.",
    // 	"keyframes": [],
    // 	"time": null,
    // 	"choices": null
    // },
    // {
    // 	"type": "Speech",
    // 	"speaker": "Anis",
    //     "speakerModel": "c012",
    //     "speakerModelEmotion": "void",
    // 	"content": "We'll be off.",
    // 	"keyframes": [],
    // 	"time": null,
    // 	"choices": null
    // },
    // {
    // 	"type": "Narration",
    // 	"speaker": null,
    //     "speakerModel": null,
    //     "speakerModelEmotion": null,
    // 	"content": "Anis leaves the room.",
    // 	"keyframes": [],
    // 	"time": null,
    // 	"choices": null
    // },
    // {
    //     "type": "Choice",
    //     "speaker": null,
    //     "content": null,
    //     "keyframes": [],
    //     "time": null,
    //     "choices": [
    //         {
    //             "text": "Too bright...",
    //             "jump": null
    //         },
    //         {
    //             "text": "new line\nnew line",
    //             "jump": null
    //         }
    //     ]
    // },
    // {
    // 	"type": "Narration",
    // 	"speaker": null,
    // 	"content": "a\na\na\na\na",
    // 	"keyframes": [],
    // 	"time": null,
    // 	"choices": null
    // }
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

function parseDialogue() {
    if (curDialogue > curScenario.length - 1) return; // quit

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
                if (characters[entry.speakerModel].emotion !== entry.speakerModelEmotion) {
                    characters[entry.speakerModel].player.playAnimationWithTrack(0, entry.speakerModelEmotion, true);
                    characters[entry.speakerModel].emotion = entry.speakerModelEmotion;
                }

                characters[entry.speakerModel].player.playAnimationWithTrack(1, "talk_start", true);
                characters[entry.speakerModel].talking = true;
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

                curDialogueCurTime = 0.0;
                if (curScenario[curDialogue].time != null) {
                    curDialogueMaxTime = curScenario[curDialogue].time;
                } else {
                    curDialogueMaxTime = 0.0;
                }

                curDialoguePlaying = true;
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

// createCharacter("c012", 4.0, 'idle', 0, 0, null, '../assets/anisl2d/c012_00');

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
                characters[i].player.playAnimationWithTrack(1, 'talk_end', true);
                characters[i].player.queueNextEmpty(1, 4 / 60);
                characters[i].talking = false;
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
            updateText(1);

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

let bef = performance.now();
renderLoop();

function renderLoop() {
    window.requestAnimationFrame(renderLoop);

    const now = performance.now();
    const elapsed = now - bef;
    bef = now;

    dialogueLoop(elapsed / 1000);
    characterLoop(elapsed / 1000);
}