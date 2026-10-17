
var Entity = require("./entity");

var Npc = module.exports = Entity.extend({
    init: function(id, kind, x, y) {
        this._super(id, "npc", kind, x, y);
    }
});