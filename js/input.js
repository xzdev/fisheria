const Input = {
  keys: {},
  prevKeys: {},

  init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      e.preventDefault();
    });
  },

  update() {
    this.prevKeys = Object.assign({}, this.keys);
  },

  isDown(code) {
    return !!this.keys[code];
  },

  justPressed(code) {
    return !!this.keys[code] && !this.prevKeys[code];
  },

  getDirectionWASD() {
    let dx = 0, dy = 0;
    if (this.isDown('KeyW')) dy = -1;
    if (this.isDown('KeyS')) dy = 1;
    if (this.isDown('KeyA')) dx = -1;
    if (this.isDown('KeyD')) dx = 1;
    return { dx, dy };
  },

  getDirectionArrows() {
    let dx = 0, dy = 0;
    if (this.isDown('ArrowUp')) dy = -1;
    if (this.isDown('ArrowDown')) dy = 1;
    if (this.isDown('ArrowLeft')) dx = -1;
    if (this.isDown('ArrowRight')) dx = 1;
    return { dx, dy };
  }
};
