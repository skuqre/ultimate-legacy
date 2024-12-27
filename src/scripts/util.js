/**
 * Calculate the time with the amount of letters. Excludes spaces and line breaks.
 * @param { String } text 
 * @returns Int
 */
function calcLength(text) {
    return text.trim().replaceAll(" ", "").replaceAll("\n", "").length * 4 / 60;
}

function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

function getLines(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var currentLine = words[0];

    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        var width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function getLinesForParagraphs(ctx, text, maxWidth) {
    let ass = text.split("\n").map(para => getLines(ctx, para, maxWidth))
    let res = []

    for (let i = 0; i < ass.length; i++) {
        for (let j = 0; j < ass[i].length; j++) {
            res.push(ass[i][j]);
        }
    }

    return res;
}

function lerp(a, b, alpha) {
    return a + alpha * (b - a);
}

function mouseOver(id, event) {
    const element = document.getElementById(id);
    const rect = element.getBoundingClientRect();

    return ((event.clientX >= rect.x && event.clientX <= rect.x + rect.width) &&
        (event.clientY >= rect.y && event.clientY <= rect.y + rect.height));
}

function mouseOverElement(element, event) {
    const rect = element.getBoundingClientRect();

    return ((event.clientX >= rect.x && event.clientX <= rect.x + rect.width) &&
        (event.clientY >= rect.y && event.clientY <= rect.y + rect.height));
}

const PIXELS_PER_SECOND = 48;

function secondsToPixel(seconds, zoom) {
    return seconds * (PIXELS_PER_SECOND * zoom);
}

function pixelsToSeconds(pixels, zoom) {
    return pixels / (PIXELS_PER_SECOND * zoom);
}

function formatTime(d) {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + ":" : "";
    var mDisplay = m + ":";
    var sDisplay = s.toString().padStart(2, "0");
    return hDisplay + mDisplay + sDisplay;
}

function popUpError(text) {
    const div = document.createElement("div");
    div.classList.add("popup");

    const span = document.createElement("span");
    span.innerHTML = text;

    div.appendChild(span);
    document.body.appendChild(div);

    setTimeout(() => {
        span.remove();
        div.remove();
    }, 1400);
}

const sfxTransIn = new Audio("../assets/sounds/trans_in.wav");
const sfxTransOut = new Audio("../assets/sounds/trans_out.wav");

function transitionStinger(manual = false) {
    const main = document.createElement("div");
    main.classList.add("stinger-main");
    main.style.backdropFilter = "blur(4px)";

    const wrapper = document.createElement("div");
    wrapper.classList.add("stinger-wrapper");

    const icon = document.createElement("div");
    icon.classList.add("stinger-icon");

    main.appendChild(wrapper);
    main.appendChild(icon);

    for (let i = 0; i < 18; i++) {
        setTimeout(() => {
            for (let j = 0; j < 22; j++) {
                const div = document.createElement("div");
                div.classList.add("stinger-box");
                div.style.top = (i * 108) + "px";
                div.style.left = (j * 108) + "px";

                wrapper.appendChild(div);

                setTimeout(() => {
                    div.style.transform = "scaleY(100%)";
                    div.style.opacity = 1;
                    div.style.backgroundColor = "black";

                    if (i == 17 && j == 21) {
                        icon.style.opacity = 0;
                    } else if (i == 4 && j == 3) {
                        icon.style.opacity = 0.75;
                        icon.style.animation = "stinger-icon-animation 1s steps(30)";
                    }

                    sfxTransIn.play();

                    function transOut() {
                        setTimeout(() => {
                            if (i == 17 && j == 21) {
                                main.remove();
                            }

                            main.style.backdropFilter = "";
                            div.style.transform = "scaleY(0%)";
                            div.style.opacity = 0;
                            div.style.backgroundColor = "#555555";

                            sfxTransOut.play()
                        }, 550);
                    }

                    if (!manual) {
                        transOut();
                    } else {
                        main.onclick = () => {
                            transOut();
                            main.onclick = null;
                        }
                    }
                }, j * 20);
            }
        }, i * 20);
    }

    document.body.appendChild(main);
}

const removeJumpSymbol = `
<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <g>
        <path fill="currentColor" id="svg_1" d="m12,22s8.029,-5.56 8,-12c0,-4.411 -3.589,-8 -8,-8s-8,3.589 -8,7.995c-0.029,6.445 7.696,11.789 8,12.005zm-1,-13l2,0l3,0l0,2l-8,0l0,-2"/>
    </g>
</svg>
`

function hexToRgb(hex) {
    var c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    }
    throw new Error('Bad Hex');
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function setNestedProperty(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    const target = keys.reduce((o, key) => o[key], obj);
    target[lastKey] = value;
}

function getNestedProperty(obj, path) {
    const keys = path.split(".");
    return keys.reduce((o, key) => (o ? o[key] : undefined), obj);
}