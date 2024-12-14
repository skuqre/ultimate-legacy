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

function transitionStinger() {
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

                    setTimeout(() => {
                        if (i == 17 && j == 21) {
                            main.remove();
                        }

                        main.style.backdropFilter = "";
                        div.style.transform = "scaleY(0%)";
                        div.style.opacity = 0;
                        div.style.backgroundColor = "#555555";
                    }, 550);
                }, j * 20);
            }
        }, i * 20);
    }

    document.body.appendChild(main);
}