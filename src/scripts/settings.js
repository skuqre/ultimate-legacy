const settings = require("electron-settings");

const defSettings = {
    "audio_bgmvolume": 1,
    "audio_sfxvolume": 1,
    "audio_vovolume": 1,

    "scenario_defname": "New False Memory",

    "auto_selchoice": "selectWhenOne",
    "auto_delafttyping": 1.5
}

for (const i of Object.keys(defSettings)) {
    if (!settings.getSync(i)) {
        settings.setSync(i, defSettings[i]);
    }
}