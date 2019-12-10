var handleInput = function() {
    var result = silverKey.keyInput;
    if (result) {
        var keys = Object.keys(result);
        var key = null;
        var value = "";
        var data = null;
        for (var i = 0; i < keys.length; i++) {
            value = '';
            key = keys[i];
            data = result[key];
            if (data === undefined) {
                value = "<span></span>";
            } else if (['combo','shortcuts','sequences','binds'].indexOf(key) === -1) {
                value = "<span>" + data + "</span>";
            } else if (['combo'].indexOf(key) !== -1) {
                if (data.length < 1) { 
                    value = "<span></span>";
                } else {
                    value = "<span>" + data.join(',') + "</span>";
                }
            } else if (key === 'sequences' || key === 'shortcuts') {
                value += "<span>" + Object.keys(data).join('/') + "</span>";
            } else if (key === 'binds') {
                data = Object.keys(data);
                if (data.length < 1) {
                    value = "<span></span>";
                } else {
                    value = "<span>" + data.join(',') + "</span>";
                }
            }
            document.getElementById(key).innerHTML = value;
        }
    }
};

window.addEventListener("load", function() {
    silverKey.debugMode(true);
    silverKey.bindElement(window);
    //window.addEventListener('keydown', silverKey.handleInput);
    window.addEventListener('keydown', handleInput);
    window.addEventListener('keyup', handleInput);
    window.addEventListener('blur', handleInput);
});