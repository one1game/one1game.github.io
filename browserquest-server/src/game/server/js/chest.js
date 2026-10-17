
var _ = require('underscore'),
    Utils = require('./utils'),
    Item = require('./item'),
    Types = require("../../shared/js/gametypes");

var Chest = module.exports = Item.extend({
    init: function(id, x, y) {
        this._super(id, Types.Entities.CHEST, x, y);
    },
    
    setItems: function(items) {
        this.items = items;
    },
    
    getRandomItem: function() {
        var nbItems = _.size(this.items),
            item = null;

        if(nbItems > 0) {
            item = this.items[Utils.random(nbItems)];
        }
        return item;
    }
});