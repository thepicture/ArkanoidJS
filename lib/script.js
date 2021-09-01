'use strict';

const HUD_WIDTH = 10;
const HUD_HEIGHT = 2;
const FIELD_WIDTH = 9;
const FIELD_HEIGHT = 12;
const BLOCK_SIZE_PX = 50;
const PLATFORM_WIDTH = 2;
const PLATFORM_HEIGHT = 0.5;
const BLOCK_WIDTH = 0.8;
const BLOCK_HEIGHT = 0.5;
const PLATFORM_DELTA_X = 2;
const BALL_SIZE_PX = BLOCK_SIZE_PX / 2;
let BALL_DELTA_X = 1;
let BALL_DELTA_Y = 1;
const BALL_DEVIATION = 2;
const BG_DELTA = 1;
const LEFT_OFFSET = BLOCK_SIZE_PX;
const GAME_SPEED = 0;
const HEALTH_DAMAGE_VAL = 30;
const IS_BG_ANIMATION = true;
const SCORE_VAL = 10;
const BLUR_DELAY = 100;
const TRACE_BEING_MS = 100;
const platformLeftEvent = new CustomEvent('platformleft');
const platformRightEvent = new CustomEvent('platformright');
const processInputEvent = new CustomEvent('processinput');
const ballRunEvent = new CustomEvent('ballrun');
const gameBreakEvent = new CustomEvent('gamebreak');
const blockBreakEvent = new CustomEvent('blockbreak');
const runGameLoopEvent = new CustomEvent('rungameloop');
const platformBlurEvent = new CustomEvent('platformblur');
const blockSet = new Set();
const buttonLeft = document.querySelector('.button-left');
const buttonRight = document.querySelector('.button-right');
const buttonSpace = document.querySelector('.button-space');
const stacker = document.querySelector('.stacker');
stacker.style.left = '0px';
stacker.style.top = BLOCK_SIZE_PX * (FIELD_HEIGHT + 3) + 'px';
stacker.style.width = BLOCK_SIZE_PX * (FIELD_WIDTH + 1) + 'px';
const info = document.querySelector('.info');
info.style.left = BLOCK_SIZE_PX + 'px';
info.style.width = BLOCK_SIZE_PX * (FIELD_WIDTH - 1) + 'px';

class InGameSound {
    static playSound(soundId, volume = 1, isLoop = false, isSolo = false) {
        let audio = document.querySelector('#' + soundId);

        if (!audio) return;
        if(isSolo) {
            for (let audioElement of document.querySelectorAll('audio')) {
                audioElement.pause();
            }
        }
        audio.volume = volume;
        audio.loop = isLoop;
        audio.play();
    }
}

class GameElement {
    draw(selector, width, height) {
        this.element = document.querySelector(selector);

        if (!this.element)
            throw new ArkanoidError(`Element "${selector}" not found`);

        this.element.style.width = BLOCK_SIZE_PX * width + 'px';
        this.element.style.height = BLOCK_SIZE_PX * height + 'px';
    }

    createElement(callback) {
        if (this.element) throw new ArkanoidError('The element is already exists');

        this.element = callback();
        document.body.append(this.element);
    }

    moveTo(x, y) {
        if (!this.element) throw new ArkanoidError('Attempt to move null element');

        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
    }

    isIntersects(anotherElement) {
        if (!anotherElement)
            throw new ArkanoidError(`Attempt to intersect null element`);
        return (
            this.element.offsetLeft <
            anotherElement.offsetLeft +
            anotherElement.clientWidth -
            anotherElement.clientLeft &&
            this.element.offsetLeft + this.element.clientWidth >
            anotherElement.offsetLeft &&
            this.element.offsetTop <
            anotherElement.offsetTop + anotherElement.clientHeight &&
            this.element.offsetTop + this.element.clientHeight >
            anotherElement.offsetTop
        );
    }

    destroy() {
        if (!this.element)
            throw new ArkanoidError(`Attempt to destroy non-existing element`);

        this.element.remove();
        this.element = null;
    }
}

class GameField extends GameElement {
}

class HUD extends GameElement {
    static healthMeter = document.querySelector('.health-meter');
    static score = document.querySelector('.score');
    static info = document.querySelector('.info');
    static scoreValue = 0;

    static setHealth(value) {
        this.healthMeter.value = value;
    }

    static setScore(value) {
        this.scoreValue = value;
        this.score.textContent = "Score: " + this.scoreValue;
    }

    static showInfo(info) {
        this.info.innerHTML = info;
    }

    static showHealthMeter(bool) {
        this.healthMeter.hidden = !bool;
    }
}

class Platform extends GameElement {
    constructor() {
        super();
        document.addEventListener('platformleft', this.moveLeft.bind(this));
        document.addEventListener('platformright', this.moveRight.bind(this));
        document.addEventListener('platformblur', this.blur.bind(this));
        this.platform = document.querySelector('.platform');
        this.platform.style.transition =
            'background-color ' + BLUR_DELAY + 'ms ease';
    }

    blur() {
        this.platform.style.backgroundColor = 'red';
        InGameSound.playSound('platform-hit');
        let timeout = setTimeout(() => {
            this.platform.style.backgroundColor = 'white';
            clearTimeout(timeout);
            timeout = null;
        }, BLUR_DELAY);
    }

    setInitialPosition(relativeElement) {
        this.moveTo(
            (relativeElement.element.offsetLeft +
                BLOCK_SIZE_PX +
                relativeElement.element.clientWidth -
                PLATFORM_WIDTH * BLOCK_SIZE_PX) /
            2,
            relativeElement.element.offsetTop +
            relativeElement.element.clientHeight -
            BLOCK_SIZE_PX
        );
    }

    moveLeft() {
        if (this.isHitLeftWall()) return;

        this.element.style.left = this.element.offsetLeft - PLATFORM_DELTA_X + 'px';
    }

    moveRight() {
        if (this.isHitRightWall()) return;

        this.element.style.left = this.element.offsetLeft + PLATFORM_DELTA_X + 'px';
    }

    isHitLeftWall() {
        return this.element.offsetLeft - PLATFORM_DELTA_X - BLOCK_SIZE_PX < 0;
    }

    isHitRightWall() {
        return (
            this.element.offsetLeft +
            PLATFORM_DELTA_X +
            PLATFORM_WIDTH * BLOCK_SIZE_PX >
            BLOCK_SIZE_PX * FIELD_WIDTH
        );
    }
}

class ArkanoidError extends Error {
    constructor(message) {
        super(message);
        this.title = 'ArkanoidError';
    }
}

class Block extends GameElement {
    constructor(x, y) {
        super();
        this.createElement(() => {
            let element = document.createElement('div');
            element.classList.add('block');
            element.style.width = BLOCK_SIZE_PX * BLOCK_WIDTH + 'px';
            element.style.height = BLOCK_SIZE_PX * BLOCK_HEIGHT + 'px';
            element.style.left = BLOCK_SIZE_PX * x + 'px';
            element.style.top = BLOCK_SIZE_PX * y + 'px';
            return element;
        });

        document.addEventListener('blockbreak', () => {
            if (blockSet.size === 0) {
                HUD.showInfo('You win. Press Space to restart');
                document.dispatchEvent(gameBreakEvent);
                HUD.showHealthMeter(false);
                HUD.setHealth(0);
            }
        });
    }
}

class Ball extends GameElement {
    constructor(initX, initY) {
        super();
        this.createElement(() => {
            let ball = document.createElement('div');
            ball.classList.add('ball');
            ball.style.left = initX * BLOCK_SIZE_PX + 'px';
            ball.style.top = initY * BLOCK_SIZE_PX + 'px';
            ball.style.width = ball.style.height = BALL_SIZE_PX + 'px';
            ball.style.borderRadius = BALL_SIZE_PX + 'px';
            return ball;
        });

        this.isMovingUp = true;
        this.isMovingLeft = Math.round(Math.random());
        document.addEventListener('ballrun', this.run.bind(this));
    }

    run() {
        if (this.isMovingLeft) {
            this.moveLeft();
        } else {
            this.moveRight();
        }

        if (this.isMovingUp) {
            this.moveUp();
        } else {
            this.moveDown();
        }

        this.isIntersectsBlock();
        if (new Date().getMilliseconds() % 2 === 0) {
            this.drawTrace();
        }
    }

    drawTrace() {
        let ballTrace = document.createElement('div');
        ballTrace.classList.add('ball');
        ballTrace.style.left = this.element.offsetLeft + 'px';
        ballTrace.style.top = this.element.offsetTop + 'px';
        ballTrace.style.backgroundColor = 'red';
        ballTrace.style.opacity = '0.1';
        ballTrace.style.width = this.element.clientWidth + 'px';
        ballTrace.style.height = this.element.clientHeight + 'px';
        ballTrace.style.borderRadius = BLOCK_SIZE_PX + 'px';
        ballTrace.style.zIndex = 1;
        document.body.append(ballTrace);
        let timeout = setTimeout(() => {
            ballTrace.remove();
            clearTimeout(timeout);
            timeout = null;
        }, TRACE_BEING_MS);
    }

    isIntersectsBlock() {
        for (let block of blockSet.keys()) {
            if (this.isIntersects(block.element)) {
                blockSet.delete(block);
                block.destroy();
                document.dispatchEvent(blockBreakEvent);
                HUD.setScore(HUD.scoreValue + SCORE_VAL);
                this.isMovingLeft = !this.isMovingLeft;
                this.isMovingUp = !this.isMovingUp;
                InGameSound.playSound('block-hit', 0.5);
                return true;
            }
        }
        return false;
    }

    updateBalLDeviation() {
        BALL_DELTA_X = Math.round(Math.random() * (BALL_DEVIATION - 1) + 1);
        BALL_DELTA_Y = Math.round(Math.random() * (BALL_DEVIATION - 1) + 1);
    }

    moveLeft() {
        if (this.isHitOnLeft()) {
            this.isMovingLeft = false;
            this.updateBalLDeviation();
            return;
        }

        this.moveTo(this.element.offsetLeft - BALL_DELTA_X, this.element.offsetTop);
    }

    moveRight() {
        if (this.isHitOnRight()) {
            this.isMovingLeft = true;
            this.updateBalLDeviation();
            return;
        }

        this.moveTo(this.element.offsetLeft + BALL_DELTA_X, this.element.offsetTop);
    }

    moveUp() {
        if (this.isHitOnTop()) {
            this.isMovingUp = false;
            this.isMovingLeft = Math.round(Math.random());
            this.updateBalLDeviation();
            return;
        }

        this.moveTo(this.element.offsetLeft, this.element.offsetTop - BALL_DELTA_Y);
    }

    moveDown() {
        if (this.isHitPlatform()) {
            document.dispatchEvent(platformBlurEvent);
            this.isMovingUp = true;
            this.isMovingLeft = Math.round(Math.random());
            this.updateBalLDeviation();
            return;
        }
        if (this.isHitOnBottom()) {
            this.freeze();
            HUD.setHealth(HUD.healthMeter.value - HEALTH_DAMAGE_VAL);
            InGameSound.playSound('ball-hit', 0.5);

            if (HUD.healthMeter.value === 0) {
                HUD.showInfo('Game over. Hit space to restart');
            } else {
                HUD.showInfo('Hit space to continue');
            }
        }

        this.moveTo(this.element.offsetLeft, this.element.offsetTop + BALL_DELTA_Y);
    }

    isHitPlatform() {
        let platform = document.querySelector('.platform');

        return (
            this.element.offsetTop +
            BALL_SIZE_PX +
            BALL_DELTA_Y -
            platform.offsetTop >
            BALL_DEVIATION &&
            platform.offsetTop &&
            this.element.offsetLeft + BALL_SIZE_PX > platform.offsetLeft &&
            this.element.offsetLeft < platform.offsetLeft + platform.clientWidth
        );
    }

    isHitOnLeft() {
        return this.element.offsetLeft - BALL_DELTA_X - BLOCK_SIZE_PX < 0;
    }

    isHitOnRight() {
        return (
            this.element.offsetLeft + BALL_DELTA_X + BALL_SIZE_PX >
            BLOCK_SIZE_PX * FIELD_WIDTH
        );
    }

    isHitOnTop() {
        return this.element.offsetTop - BALL_DELTA_Y < BLOCK_SIZE_PX * HUD_HEIGHT;
    }

    isHitOnBottom() {
        return (
            this.element.offsetTop + BALL_SIZE_PX + BALL_DELTA_Y >
            (FIELD_HEIGHT + HUD_HEIGHT) * BLOCK_SIZE_PX
        );
    }

    freeze() {
        document.dispatchEvent(gameBreakEvent);
    }

    centralize() {
        this.moveTo(
            (BLOCK_SIZE_PX * (FIELD_WIDTH + 1) - BALL_SIZE_PX) / 2,
            FIELD_HEIGHT * BLOCK_SIZE_PX + BALL_SIZE_PX
        );
    }
}

class InputProcessor {
    constructor() {
        this.heldKeySet = new Set();
        document.addEventListener('processinput', this.processInput.bind(this));
    }

    connect() {
        document.addEventListener('keydown', (event) => {
            event.preventDefault();

            this.addInput(event.code);
        });

        document.addEventListener('keyup', (event) => {
            event.preventDefault();

            this.removeInput(event.code);
        });

        buttonLeft.addEventListener('pointerdown', () => {
            this.addInput('KeyA');
        });

        buttonRight.addEventListener('pointerdown', () => {
            this.addInput('KeyD');
        });

        buttonLeft.addEventListener('pointerup', () => {
            this.removeInput('KeyA');
        });

        buttonRight.addEventListener('pointerup', () => {
            this.removeInput('KeyD');
        });

        buttonSpace.addEventListener('pointerdown', () => {
            document.dispatchEvent(runGameLoopEvent);
        });
    }

    disconnect() {
        document.removeEventListener('keydown', (event) => {
            event.preventDefault();

            this.addInput(event.code);
        });

        document.removeEventListener('keyup', (event) => {
            event.preventDefault();

            this.removeInput(event.code);
        });

        buttonLeft.removeEventListener('pointerdown', () => {
            this.addInput('KeyA');
        });

        buttonRight.removeEventListener('pointerdown', () => {
            this.addInput('KeyD');
        });

        buttonSpace.removeEventListener('pointerdown', () => {
            this.addInput('Space');
        });
    }

    processInput() {
        if (this.heldKeySet.has('KeyA')) {
            document.dispatchEvent(platformLeftEvent);
        } else if (this.heldKeySet.has('KeyD')) {
            document.dispatchEvent(platformRightEvent);
        }
    }

    addInput(keyCode) {
        this.heldKeySet.add(keyCode);
    }

    removeInput(keyCode) {
        this.heldKeySet.delete(keyCode);
    }
}

class BlockGenerator {
    static generate() {
        for (let i = LEFT_OFFSET / BLOCK_SIZE_PX; i < FIELD_WIDTH; i++) {
            for (let j = 0; j < FIELD_HEIGHT / 2; j++) {
                blockSet.add(new Block(i, j + HUD_HEIGHT + 1));
            }
        }
    }

    static clearAll() {
        for (let block of blockSet.keys()) {
            block.destroy();
            blockSet.delete(block);
        }
    }
}

class GameInit {
    static ball;
    static platform;
    static gameField;

    static initialize() {
        const hud = new HUD();
        hud.draw('.hud', HUD_WIDTH, HUD_HEIGHT);
        hud.moveTo(0, 0);

        GameInit.gameField = new GameField();
        GameInit.gameField.draw('.game-field', FIELD_WIDTH, FIELD_HEIGHT);
        GameInit.gameField.moveTo(0, HUD_HEIGHT * BLOCK_SIZE_PX);

        GameInit.platform = new Platform();
        GameInit.platform.draw('.platform', PLATFORM_WIDTH, PLATFORM_HEIGHT);

        GameInit.ball = new Ball(0, 0);

        GameInit.centralizeThings();

        Background.initialize();
        if (IS_BG_ANIMATION) {
            Background.animate();
        }

        const inputProcessor = new InputProcessor();
        inputProcessor.connect();

        const gameLoop = new GameLoop(GAME_SPEED);
        document.addEventListener('rungameloop', gameLoop.run.bind(gameLoop));

        this.isRunning = true;
    }

    static centralizeThings() {
        if (GameInit.platform && GameInit.gameField) {
            GameInit.platform.setInitialPosition(GameInit.gameField);
        }

        if (GameInit.ball) {
            GameInit.ball.centralize();
            GameInit.ball.isMovingUp = true;
        }
    }

    static restart() {
        BlockGenerator.clearAll();
        BlockGenerator.generate();
        this.centralizeThings();
        HUD.healthMeter.value = HUD.healthMeter.max;
        HUD.showInfo(null);
        HUD.setScore(0);
        HUD.showHealthMeter(true);
    }
}

class GameLoop {
    constructor(speed = 0) {
        if (speed < 0)
            throw new ArkanoidError('Attempt to assign a negative GameLoop speed');

        this.speed = speed;
        document.addEventListener('gamebreak', this.break.bind(this));
    }

    run() {
        if (this.interval) return;

        if (HUD.healthMeter.value === 0) {
            GameInit.restart();
        }

        if (blockSet.size === 0) {
            BlockGenerator.generate();
        }

        HUD.showInfo(null);

        GameInit.centralizeThings();

        this.interval = setInterval(() => {
            document.dispatchEvent(processInputEvent);
            document.dispatchEvent(ballRunEvent);
        }, this.speed);

        InGameSound.playSound('in-game', 0.4, true, true);
    }

    break() {
        if (!this.interval)
            throw new ArkanoidError('No GameLoop avalaible to break');

        clearInterval(this.interval);
        this.interval = null;
        this.isRunning = false;
        InGameSound.playSound('await', 1, true, true);
    }
}

class Background {
    static initialize() {
        for (let i = -1; i < FIELD_WIDTH; i++) {
            for (let j = -3; j < FIELD_HEIGHT; j++) {
                let bgBlock = document.createElement('div');

                this.bgBlocksHolder = document.querySelector('.background');
                bgBlock.classList.add('bg-block');
                bgBlock.style.width = bgBlock.style.height = BLOCK_SIZE_PX + 'px';
                bgBlock.style.left = BLOCK_SIZE_PX * i + 'px';
                bgBlock.style.top = BLOCK_SIZE_PX * (j + HUD_HEIGHT) + 'px';

                this.bgBlocksHolder.append(bgBlock);
                this.delta = 0;
            }
        }

        let blackDivOnTheRight = document.createElement('div');
        blackDivOnTheRight.classList.add('black-area');
        blackDivOnTheRight.style.left = BLOCK_SIZE_PX * FIELD_WIDTH + 'px';
        blackDivOnTheRight.style.top = '0px';
        blackDivOnTheRight.style.width = BLOCK_SIZE_PX + 'px';
        blackDivOnTheRight.style.height =
            BLOCK_SIZE_PX * (FIELD_HEIGHT + HUD_HEIGHT) + 'px';
        document.body.append(blackDivOnTheRight);

        let blackDivOnTheBottom = document.createElement('div');
        blackDivOnTheBottom.classList.add('black-area');
        blackDivOnTheBottom.style.left = '0px';
        blackDivOnTheBottom.style.top =
            BLOCK_SIZE_PX * (FIELD_HEIGHT + HUD_HEIGHT) + 'px';
        blackDivOnTheBottom.style.width = BLOCK_SIZE_PX * (FIELD_WIDTH + 1) + 'px';
        blackDivOnTheBottom.style.height = BLOCK_SIZE_PX + 'px';
        document.body.append(blackDivOnTheBottom);

        let blackDivOnTheLeft = document.createElement('div');
        blackDivOnTheLeft.classList.add('black-area');
        blackDivOnTheLeft.style.left = '0px';
        blackDivOnTheLeft.style.top = '0px';
        blackDivOnTheLeft.style.width = BLOCK_SIZE_PX + 'px';
        blackDivOnTheLeft.style.height =
            BLOCK_SIZE_PX * (FIELD_HEIGHT + HUD_HEIGHT) + 'px';
        document.body.append(blackDivOnTheLeft);
    }

    static animate() {
        setInterval(() => {
            if (this.delta + BG_DELTA > BLOCK_SIZE_PX) {
                this.bgBlocksHolder.style.top = '0px';
                this.bgBlocksHolder.style.left = '0px';
                this.delta = 0;
            }
            this.bgBlocksHolder.style.top =
                this.bgBlocksHolder.offsetTop + BG_DELTA + 'px';
            this.bgBlocksHolder.style.left =
                this.bgBlocksHolder.offsetLeft + BG_DELTA + 'px';
            this.delta++;
        }, 50);
    }
}

document.addEventListener('DOMContentLoaded', GameInit.initialize);

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        document.dispatchEvent(runGameLoopEvent);
    }
});
