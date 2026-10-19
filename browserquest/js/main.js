
define(['jquery', 'app'], function($, App) {
    var app, game;

    // Применение настроек доступно и из initGame (другая область видимости).
    var applySettings = function() {};

    // Процедурный эмбиент: ветер и дождь синтезируются на лету,
    // без дополнительных аудиофайлов.
    var Ambience = (function() {
        var ctx = null,
            master = null,
            rainGain = null,
            started = false;

        var noiseBuffer = function(context, seconds) {
            var buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate),
                data = buffer.getChannelData(0);

            for(var i = 0; i < data.length; i += 1) {
                data[i] = Math.random() * 2 - 1;
            }
            return buffer;
        };

        return {
            start: function() {
                if(started) {
                    return;
                }

                var AudioCtx = window.AudioContext || window.webkitAudioContext;
                if(!AudioCtx) {
                    return;
                }

                ctx = new AudioCtx();
                started = true;

                master = ctx.createGain();
                master.gain.value = 0;
                master.connect(ctx.destination);

                // Ветер: низкочастотный шум.
                var wind = ctx.createBufferSource();
                wind.buffer = noiseBuffer(ctx, 4);
                wind.loop = true;

                var windFilter = ctx.createBiquadFilter();
                windFilter.type = "lowpass";
                windFilter.frequency.value = 380;

                var windGain = ctx.createGain();
                windGain.gain.value = 0.05;

                wind.connect(windFilter);
                windFilter.connect(windGain);
                windGain.connect(master);
                wind.start();

                // Медленное «дыхание» ветра.
                var lfo = ctx.createOscillator();
                lfo.frequency.value = 0.07;

                var lfoGain = ctx.createGain();
                lfoGain.gain.value = 0.025;

                lfo.connect(lfoGain);
                lfoGain.connect(windGain.gain);
                lfo.start();

                // Дождь: высокочастотный шум, включается вместе с погодой.
                var rain = ctx.createBufferSource();
                rain.buffer = noiseBuffer(ctx, 4);
                rain.loop = true;

                var rainFilter = ctx.createBiquadFilter();
                rainFilter.type = "highpass";
                rainFilter.frequency.value = 1100;

                rainGain = ctx.createGain();
                rainGain.gain.value = 0;

                rain.connect(rainFilter);
                rainFilter.connect(rainGain);
                rainGain.connect(master);
                rain.start();
            },

            resume: function() {
                if(ctx && ctx.state === "suspended") {
                    ctx.resume();
                }
            },

            setRain: function(on) {
                if(rainGain && ctx) {
                    rainGain.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 1.2);
                }
            },

            setVolume: function(volume) {
                if(master && ctx) {
                    var v = Math.max(0, Math.min(1, volume));
                    master.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.4);
                }
            }
        };
    })();

    var initApp = function() {
        $(document).ready(function() {
        	app = new App();
            app.center();
        
            if(Detect.isWindows()) {
                // Workaround for graphical glitches on text
                $('body').addClass('windows');
            }
            
            if(Detect.isOpera()) {
                // Fix for no pointer events
                $('body').addClass('opera');
            }
        
            $('body').click(function(event) {
                if($('#parchment').hasClass('credits')) {
                    app.toggleCredits();
                }
                
                if($('#parchment').hasClass('about')) {
                    app.toggleAbout();
                }
            });
	
        	$('.barbutton').click(function() {
        	    $(this).toggleClass('active');
        	});
	
        	$('#chatbutton').click(function() {
        	    if($('#chatbutton').hasClass('active')) {
        	        app.showChat();
        	    } else {
                    app.hideChat();
        	    }
        	});
	
        	$('#helpbutton').click(function() {
                app.toggleAbout();
        	});
	
        	$('#achievementsbutton').click(function() {
                app.toggleAchievements();
                if(app.blinkInterval) {
                    clearInterval(app.blinkInterval);
                }
                $(this).removeClass('blink');
        	});
	
        	$('#instructions').click(function() {
                app.hideWindows();
        	});
        	
        	$('#playercount').click(function() {
        	    app.togglePopulationInfo();
        	});
        	
        	$('#population').click(function() {
        	    app.togglePopulationInfo();
        	});
	
        	$('.clickable').click(function(event) {
                event.stopPropagation();
        	});
	
        	$('#toggle-credits').click(function() {
        	    app.toggleCredits();
        	});
	
        	$('#create-new span').click(function() {
        	    app.animateParchment('loadcharacter', 'confirmation');
        	});
	
        	$('.delete').click(function() {
                app.storage.clear();
        	    app.animateParchment('confirmation', 'createcharacter');
        	});
	
        	$('#cancel span').click(function() {
        	    app.animateParchment('confirmation', 'loadcharacter');
        	});
        	
        	$('.ribbon').click(function() {
        	    app.toggleAbout();
        	});

            $('#nameinput').bind("keyup", function() {
                app.toggleButton();
            });
    
            $('#previous').click(function() {
                var $achievements = $('#achievements');
        
                if(app.currentPage === 1) {
                    return false;
                } else {
                    app.currentPage -= 1;
                    $achievements.removeClass().addClass('active page' + app.currentPage);
                }
            });
    
            $('#next').click(function() {
                var $achievements = $('#achievements'),
                    $lists = $('#lists'),
                    nbPages = $lists.children('ul').length;
        
                if(app.currentPage === nbPages) {
                    return false;
                } else {
                    app.currentPage += 1;
                    $achievements.removeClass().addClass('active page' + app.currentPage);
                }
            });

            $('#notifications div').bind(TRANSITIONEND, app.resetMessagesPosition.bind(app));
    
            $('.close').click(function() {
                app.hideWindows();
            });
        
            $('.twitter').click(function() {
                var url = $(this).attr('href');

               app.openPopup('twitter', url);
               return false;
            });

            $('.facebook').click(function() {
                var url = $(this).attr('href');

               app.openPopup('facebook', url);
               return false;
            });
        
            var data = app.storage.data;
    		if(data.hasAlreadyPlayed) {
    		    if(data.player.name && data.player.name !== "") {
		            $('#playername').html(data.player.name);
    		        $('#playerimage').attr('src', data.player.image);
    		    }
    		}
    		
    		$('.play div').click(function(event) {
                var nameFromInput = $('#nameinput').attr('value'),
                    nameFromStorage = $('#playername').html(),
                    name = nameFromInput || nameFromStorage;
                
                app.tryStartingGame(name);
            });
        
            document.addEventListener("touchstart", function() {},false);
            
            $('#resize-check').bind("transitionend", app.resizeUi.bind(app));
            $('#resize-check').bind("webkitTransitionEnd", app.resizeUi.bind(app));
            $('#resize-check').bind("oTransitionEnd", app.resizeUi.bind(app));
        
            log.info("App initialized.");
        
            initGame();
        });
    };
    
    var initGame = function() {
        require(['game'], function(Game) {
            log.info("Game module loaded.");

            var canvas = document.getElementById("entities"),
        	    background = document.getElementById("background"),
        	    foreground = document.getElementById("foreground"),
        	    input = document.getElementById("chatinput");

    		game = new Game(app);
    		game.setup('#bubbles', canvas, background, foreground, input);
    		game.setStorage(app.storage);
    		app.setGame(game);

            // Для отладки в консоли: window.game / window.app
            window.game = game;
            window.app = app;
    		
    		// Карта грузится сразу на всех устройствах: на десктопе через Worker,
    		// на мобильных — Ajax-запросом (выбор внутри Map).
    		game.loadMap();
	
    		game.onGameStart(function() {
                app.initEquipmentIcons();
                applySettings();
    		});
    		
    		game.onDisconnect(function(message) {
    		    $('#death').find('p').html(message+"<em>Перезагрузите страницу.</em>");
    		    $('#respawn').hide();
    		});
	
    		game.onPlayerDeath(function() {
    		    if($('body').hasClass('credits')) {
    		        $('body').removeClass('credits');
    		    }
                $('body').addClass('death');
    		});
	
    		game.onPlayerEquipmentChange(function() {
    		    app.initEquipmentIcons();
    		});
	
    		game.onPlayerInvincible(function() {
    		    $('#hitpoints').toggleClass('invincible');
    		});

    		game.onNbPlayersChange(function(worldPlayers, totalPlayers) {
    		    var playersWord = function(n) {
    		        var mod10 = n % 10, mod100 = n % 100;
    		        if(mod10 === 1 && mod100 !== 11) {
    		            return "игрок";
    		        } else if(mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    		            return "игрока";
    		        } else {
    		            return "игроков";
    		        }
    		    };
    		    var setWorldPlayersString = function(string) {
        		        $("#instance-population").find("span:nth-child(2)").text(string);
        		        $("#playercount").find("span:nth-child(2)").text(string);
        		    },
        		    setTotalPlayersString = function(string) {
        		        $("#world-population").find("span:nth-child(2)").text(string);
        		    };
    		    
    		    $("#playercount").find("span.count").text(worldPlayers);
    		    
    		    $("#instance-population").find("span").text(worldPlayers);
    		    setWorldPlayersString(playersWord(worldPlayers));
    		    
    		    $("#world-population").find("span").text(totalPlayers);
    		    setTotalPlayersString(playersWord(totalPlayers));
    		});
	
    		game.onAchievementUnlock(function(id, name, description) {
    		    app.unlockAchievement(id, name);
    		});
	
    		game.onNotification(function(message) {
    		    app.showMessage(message);
    		});
	
            app.initHealthBar();
	
            $('#nameinput').attr('value', '');
    		$('#chatbox').attr('value', '');
    		
        	if(game.renderer.mobile || game.renderer.tablet) {
                $('#foreground').bind('touchstart', function(event) {
                    app.center();
                    app.setMouseCoordinates(event.originalEvent.touches[0]);
                	game.click();
                	app.hideWindows();
                });
            } else {
                $('#foreground').click(function(event) {
                    app.center();
                    app.setMouseCoordinates(event);
                    if(game) {
                	    game.click();
                	}
                	app.hideWindows();
                    // $('#chatinput').focus();
                });
            }

            $('body').unbind('click');
            $('body').click(function(event) {
                var hasClosedParchment = false;
                
                if($('#parchment').hasClass('credits')) {
                    if(game.started) {
                        app.closeInGameCredits();
                        hasClosedParchment = true;
                    } else {
                        app.toggleCredits();
                    }
                }
                
                if($('#parchment').hasClass('about')) {
                    if(game.started) {
                        app.closeInGameAbout();
                        hasClosedParchment = true;
                    } else {
                        app.toggleAbout();
                    }
                }
                
                if(game.started && !game.renderer.mobile && game.player && !hasClosedParchment) {
                    game.click();
                }
            });
            
            $('#respawn').click(function(event) {
                game.audioManager.playSound("revive");
                game.restart();
                $('body').removeClass('death');
            });
            
            $(document).mousemove(function(event) {
            	app.setMouseCoordinates(event);
            	if(game.started) {
            	    game.movecursor();
            	}
            });

            $(document).keydown(function(e) {
            	var key = e.which,
                    $chat = $('#chatinput');

                if(key === 13) {
                    if($('#chatbox').hasClass('active')) {
                        app.hideChat();
                    } else {
                        app.showChat();
                    }
                }
            });
            
            $('#chatinput').keydown(function(e) {
                var key = e.which,
                    $chat = $('#chatinput');

                if(key === 13) {
                    if($chat.attr('value') !== '') {
                        if(game.player) {
                            game.say($chat.attr('value'));
                        }
                        $chat.attr('value', '');
                        app.hideChat();
                        $('#foreground').focus();
                        return false;
                    } else {
                        app.hideChat();
                        return false;
                    }
                }
                
                if(key === 27) {
                    app.hideChat();
                    return false;
                }
            });

            $('#nameinput').keypress(function(event) {
                var $name = $('#nameinput'),
                    name = $name.attr('value');

                if(event.keyCode === 13) {
                    if(name !== '') {
                        app.tryStartingGame(name, function() {
                            $name.blur(); // exit keyboard on mobile
                        });
                        return false; // prevent form submit
                    } else {
                        return false; // prevent form submit
                    }
                }
            });
            
            $('#mutebutton').click(function() {
                game.audioManager.toggle();
                settings.sound = game.audioManager.enabled;
                saveSettings();
                applySettings();
            });

            // --- Настройки, погода, полный экран ---
            var settingsKey = "bq_settings_v1",
                settings = {sound:true, volume:70, cinema:true, rain:false};

            try {
                if(window.localStorage && localStorage[settingsKey]) {
                    $.extend(settings, JSON.parse(localStorage[settingsKey]));
                }
            } catch(e) {}

            var saveSettings = function() {
                try {
                    if(window.localStorage) {
                        localStorage[settingsKey] = JSON.stringify(settings);
                    }
                } catch(e) {}
            };

            applySettings = function() {
                $('body').toggleClass('no-cinema', !settings.cinema);
                $('body').toggleClass('rain', settings.rain);
                $('#opt-sound').prop('checked', settings.sound);
                $('#opt-volume').val(settings.volume);
                $('#opt-cinema').prop('checked', settings.cinema);
                $('#opt-rain').prop('checked', settings.rain);
                $('#mutebutton').toggleClass('active', settings.sound);

                if(game.audioManager) {
                    game.audioManager.setVolume(settings.volume / 100);
                }

                if(game.audioManager && game.audioManager.enabled !== settings.sound) {
                    game.audioManager.toggle();
                }

                Ambience.setVolume(settings.sound ? settings.volume / 100 : 0);
                Ambience.setRain(settings.rain && settings.sound);
            };

            var openSettings = function() {
                applySettings();
                $('#settings').addClass('active');
            };

            var closeSettings = function() {
                $('#settings').removeClass('active');
            };

            var isFullscreen = function() {
                return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            };

            var fullscreenSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled);

            var updateFullscreenLabel = function() {
                var active = isFullscreen();

                $('#opt-fullscreen').text(active ? "Выключить" : "Включить");
                $('#fullscreen-button')
                    .toggleClass('is-fullscreen', active)
                    .attr('aria-label', active ? "Выйти из полноэкранного режима" : "Полный экран")
                    .attr('aria-pressed', active ? "true" : "false");
            };

            var toggleFullscreen = function() {
                var el = document.documentElement;

                if(!isFullscreen()) {
                    var request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;

                    if(request) {
                        try {
                            // navigationUI: "hide" убирает браузерный интерфейс там, где поддерживается.
                            request.call(el, { navigationUI: "hide" });
                        } catch(e) {
                            request.call(el);
                        }
                    }
                } else {
                    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || function() {}).call(document);
                }
            };

            if(!fullscreenSupported) {
                $('#fullscreen-button').hide();
            }

            var applyTimeOfDay = function() {
                var h = new Date().getHours(),
                    cls = "time-night";

                if(h >= 5 && h < 9) {
                    cls = "time-dawn";
                } else if(h >= 9 && h < 18) {
                    cls = "time-day";
                } else if(h >= 18 && h < 22) {
                    cls = "time-dusk";
                }

                $('body').removeClass('time-dawn time-day time-dusk time-night').addClass(cls);
            };

            $('#opt-sound').change(function() {
                settings.sound = this.checked;
                saveSettings();
                applySettings();
            });

            $('#opt-volume').bind('input change', function() {
                settings.volume = parseInt(this.value, 10);
                saveSettings();
                applySettings();
            });

            $('#opt-cinema').change(function() {
                settings.cinema = this.checked;
                saveSettings();
                applySettings();
            });

            $('#opt-rain').change(function() {
                settings.rain = this.checked;
                saveSettings();
                applySettings();
            });

            $('#opt-fullscreen').click(toggleFullscreen);
            $('#fullscreen-button').click(toggleFullscreen);
            $(document).bind('fullscreenchange webkitfullscreenchange msfullscreenchange', updateFullscreenLabel);

            // Запускаем процедурный эмбиент после первого действия пользователя
            // (требование браузеров к автозапуску аудио).
            $(document).one('click keydown', function() {
                Ambience.start();
                setTimeout(function() {
                    Ambience.resume();
                    applySettings();
                }, 0);
            });

            // Мягкий свет вокруг персонажа.
            var $playerLight = $('#player-light'),
                lightVisible = false;

            var updatePlayerLight = function() {
                window.requestAnimationFrame(updatePlayerLight);

                if(!game || !game.started || !game.player || !game.renderer || !game.renderer.camera) {
                    if(lightVisible) {
                        $playerLight.hide();
                        lightVisible = false;
                    }
                    return;
                }

                var s = game.renderer.scale,
                    t = game.renderer.tilesize,
                    x = (game.player.x - game.renderer.camera.x) * s + (t * s) / 2,
                    y = (game.player.y - game.renderer.camera.y) * s + (t * s) / 2;

                if(!lightVisible) {
                    $playerLight.show();
                    lightVisible = true;
                }

                $playerLight.css({ left: x + "px", top: y + "px" });
            };

            window.requestAnimationFrame(updatePlayerLight);

            applyTimeOfDay();
            setInterval(applyTimeOfDay, 60000);
            updateFullscreenLabel();
            applySettings();
            
            $(document).bind("keydown", function(e) {
            	var key = e.which,
            	    $chat = $('#chatinput');

                if($('#chatinput:focus').size() == 0 && $('#nameinput:focus').size() == 0) {
                    if(key === 13) { // Enter
                        if(game.ready) {
                            $chat.focus();
                            return false;
                        }
                    }
                    if(key === 32) { // Space
                        // game.togglePathingGrid();
                        return false;
                    }
                    if(key === 70) { // F
                        toggleFullscreen();
                        return false;
                    }
                    if(key === 27) { // ESC
                        if($('#settings').hasClass('active')) {
                            closeSettings();
                            return false;
                        }

                        var hadWindows = $('#instructions').hasClass('active') || $('#achievements').hasClass('active');

                        app.hideWindows();

                        if(game.player) {
                            _.each(game.player.attackers, function(attacker) {
                                attacker.stop();
                            });
                        }

                        if(!hadWindows && game.started && game.player && !game.player.isDead) {
                            openSettings();
                        }
                        return false;
                    }
                    if(key === 65) { // a
                        // game.player.hit();
                        return false;
                    }
                } else {
                    if(key === 13 && game.ready) {
                        $chat.focus();
                        return false;
                    }
                }
            });
            
            if(game.renderer.tablet) {
                $('body').addClass('tablet');
            }
        });
    };
    
    initApp();
});
