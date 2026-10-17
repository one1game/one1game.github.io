
var cls = require("./lib/class"),
    Entity = require("./entity"),
    Messages = require("./message"),
    Utils = require("./utils"),
    Properties = require("./properties"),
    Types = require("../../shared/js/gametypes");

var Character = module.exports = Entity.extend({
    init: function(id, type, kind, x, y) {
        this._super(id, type, kind, x, y);
        
        this.orientation = Utils.randomOrientation();
        this.attackers = {};
        this.target = null;
    },
    
    getState: function() {
        var basestate = this._getBaseState(),
            state = [];
        
        state.push(this.orientation);
        if(this.target) {
            state.push(this.target);
        }
        
        return basestate.concat(state);
    },
    
    resetHitPoints: function(maxHitPoints) {
        this.maxHitPoints = maxHitPoints;
        this.hitPoints = this.maxHitPoints;
    },
    
    regenHealthBy: function(value) {
        var hp = this.hitPoints,
            max = this.maxHitPoints;
            
        if(hp < max) {
            if(hp + value <= max) {
                this.hitPoints += value;
            }
            else {
                this.hitPoints = max;
            }
        }
    },
    
    hasFullHealth: function() {
        return this.hitPoints === this.maxHitPoints;
    },
    
    setTarget: function(entity) {
        this.target = entity.id;
    },
    
    clearTarget: function() {
        this.target = null;
    },
    
    hasTarget: function() {
        return this.target !== null;
    },
    
    attack: function() {
        return new Messages.Attack(this.id, this.target);
    },
    
    health: function() {
        return new Messages.Health(this.hitPoints, false);
    },
    
    regen: function() {
        return new Messages.Health(this.hitPoints, true);
    },
    
    addAttacker: function(entity) {
        if(entity) {
            this.attackers[entity.id] = entity;
        }
    },
    
    removeAttacker: function(character) {
        if(character && character.id in this.attackers) {
            delete this.attackers[character.id];
        }
    },
    
    forEachAttacker: function(callback) {
        for(var id in this.attackers) {
            callback(this.attackers[id]);
        }
    }
});