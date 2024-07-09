/*
This script handles dialogue playback.
*/

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

var curScenario = [];
var curDialogue = 0;

var curDialogueSpeaker = "";
var curDialogueContent = [];
var curDialogueChoices = [];
var curDialogueState = "speech";

var dialogueSpeakerText = document.getElementById("dialogue-text-speaker");
var dialogueContentText = document.getElementById("dialogue-text-content");
var dialogueNarrationText = document.querySelector("div#dialogue-element-narrationbox > span");
var dialogueChoiceList = document.getElementById("dialogue-container-choices");

function parseDialogue() {

}

/**
 * To replicate the typewriter effect has, each letter is placed in a `span` element.
 * You can easily create these arrays of spans by using this function.
 * @param { String } text 
 */
function setText(text) {
    const split = text.trim().split("");
    curDialogueContent.splice(0, curDialogueContent.length);

    for (let i = 0; i < split.length; i++) {
        let letter = split[i];
        let addTo = null;

        switch (curDialogueState) {
            case 'speech':
                addTo = dialogueContentText;
                break;
            case 'narration':
                addTo = dialogueNarrationText;
                break;
            case 'choice':
                break;
        }

        if (letter === " ") {
            addTo.innerHTML += ' ';
        } else {
            const span = document.createElement("span")
            span.innerHTML = letter;
            span.style.opacity = "0";
            addTo.appendChild(span);
            curDialogueContent.push(span);
        }
    }
}

/*
<div class="choice oneline">
    <div class="choice-deco">
        <img src="../assets/images/choice_mesh.png" class="mesh-left" />
        <img src="../assets/images/choice_mesh.png" class="mesh-right" />
    </div>
    <div class="choice-deco" id="choice-deco-tri">
        <img src="../assets/images/choice_tri_glow.png" class="tri-left" />
        <img src="../assets/images/choice_tri_glow.png" class="tri-right" />
    </div>
    <span></span>
</div>
 */
function addChoice(choice = '', jumpTo = '') {
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

    for (let i = 0; i < curDialogueChoices.length; i++) {
        const choice = curDialogueChoices[i];
        const measure = choiceMeasureText(choice.text);
        const isOneline = measure.width < (468 - 48);

        const main = document.createElement("div");
        main.classList.add("choice");
        if (isOneline) {
            main.classList.add("oneline");
        }

        const deco1 = document.createElement("div");
        deco1.classList.add("choice-deco");

        const mesh1 = document.createElement("img");
        mesh1.src = "../assets/images/choice_mesh.png";
        mesh1.classList.add("mesh-left");
        deco1.appendChild(mesh1);

        const mesh2 = document.createElement("img");
        mesh2.src = "../assets/images/choice_mesh.png";
        mesh2.classList.add("mesh-right");
        deco1.appendChild(mesh2);

        const deco2 = document.createElement("div");
        deco2.classList.add("choice-deco");
        deco2.id = "choice-deco-tri"

        const tri1 = document.createElement("img");
        tri1.src = "../assets/images/choice_tri_glow.png";
        tri1.classList.add("tri-left");
        deco2.appendChild(tri1);

        const tri2 = document.createElement("img");
        tri2.src = "../assets/images/choice_tri_glow.png";
        tri2.classList.add("tri-right");
        deco2.appendChild(tri2);

        main.appendChild(deco1);
        main.appendChild(deco2);

        const span = document.createElement("span");
        span.innerHTML = choice.text;

        main.appendChild(span);

        dialogueChoiceList.appendChild(main);
    }
}

// addChoice("Wrap Marian's bandage back on.")
// addChoice("Also, that I graduated from the military academy.")

/**
 * Measure text with choice styles. Used to differentiate single line choices and multiline choices.
 * @param { String } text 
 */
function choiceMeasureText(text) {
    ctx.font = "21px Pretendard-Semibold";
    ctx.letterSpacing = "0.3px";
    return ctx.measureText(text);
}