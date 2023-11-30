// app.js
import { createSignal, onMount, onCleanup } from 'solid-js';

// events
import { useKeyDownList } from '@solid-primitives/keyboard';

// images
import ThorNormal from './assets/images/Thor_normal.webp';
import ThorTalking from './assets/images/Thor_talking.webp';
import Goblin from './assets/images/Goblin.webp';

function App() {
  // all images
  let thorImage = new Image();
  let goblinImage = new Image();

  // window size
  const [windowSize, setWindowSize] = createSignal({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // keys pressed event listener
  const [pressedKeys] = useKeyDownList();

  // keep track if game is paused
  const [isPaused, setIsPaused] = createSignal(false);

  const [isGameOver, setIsGameOver] = createSignal(false);

  // player current position
  const [position, setPosition] = createSignal({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const [velocity, setVelocity] = createSignal({ x: 0, y: 0 });
  const [enemies, setEnemies] = createSignal([]);
  const [bullets, setBullets] = createSignal([]);
  const size = { width: 100, height: 100 };
  const bulletSize = { width: 7, height: 7 };
  const maxSpeed = 5;
  const acceleration = 0.5;
  const deceleration = 0.5;
  const bulletSpeed = 10;
  let animationFrameId;

  onMount(() => {
    thorImage.src = ThorNormal;
    goblinImage.src = Goblin;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    thorImage.onload = () => {};
  });

  const togglePause = () => {
    setIsPaused(!isPaused());
    draw();
  };

  const updateVelocity = () => {
    let vel = velocity();
    // let keys = keyState();

    // console.log('pressed keys: ', pressedKeys());
    let wasdKeys = { w: 0, a: 0, s: 0, d: 0 };

    const checkedKeys = Object.keys(wasdKeys);

    // see if w, a, s, or d is in pressed keys, if so updeate the wasdkeys value for that key to 1
    for (let i = 0; i < checkedKeys.length; i++) {
      const currentKey = checkedKeys[i];
      if (pressedKeys().includes(currentKey.toUpperCase())) {
        wasdKeys[currentKey] = 1;
      }
    }

    // Calculate the net direction from key states
    let directionX = wasdKeys.d - wasdKeys.a;
    let directionY = wasdKeys.s - wasdKeys.w;

    // Apply acceleration or deceleration
    vel.x += directionX
      ? acceleration * directionX
      : -deceleration * Math.sign(vel.x);
    vel.y += directionY
      ? acceleration * directionY
      : -deceleration * Math.sign(vel.y);

    // Clamp the velocity to the maxSpeed
    vel.x = Math.max(Math.min(vel.x, maxSpeed), -maxSpeed);
    vel.y = Math.max(Math.min(vel.y, maxSpeed), -maxSpeed);

    // Stop the square if the velocity is below the deceleration threshold
    if (Math.abs(vel.x) < deceleration && directionX === 0) vel.x = 0;
    if (Math.abs(vel.y) < deceleration && directionY === 0) vel.y = 0;

    setVelocity(vel);

    handleCollisions();
  };

  const updatePosition = () => {
    const pos = position();
    const vel = velocity();
    setPosition({
      x: Math.max(Math.min(pos.x + vel.x, window.innerWidth - size.width), 0),
      y: Math.max(Math.min(pos.y + vel.y, window.innerHeight - size.height), 0),
    });
  };

  const updateBullets = () => {
    setBullets((prevBullets) => {
      return prevBullets
        .map((bullet) => {
          const dx = bullet.speed * bullet.direction.x;
          const dy = bullet.speed * bullet.direction.y;
          return { ...bullet, x: bullet.x + dx, y: bullet.y + dy };
        })
        .filter((bullet) => {
          return (
            bullet.x >= 0 &&
            bullet.x <= window.innerWidth &&
            bullet.y >= 0 &&
            bullet.y <= window.innerHeight
          );
        });
    });
  };

  const endGame = () => {
    cancelAnimationFrame(animationFrameId); // Stop the animation loop
    setIsGameOver(true); // Set the game over state to true

    // Draw the game over message
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 50);
    ctx.font = '24px Arial';
    ctx.fillText(
      'Press Space to Retry',
      canvas.width / 2,
      canvas.height / 2 + 20
    );
  };

  const update = () => {
    if (!isPaused()) {
      updateVelocity();
      updatePosition();
      updateBullets();
      updateGoblins();
      draw();

      // Check for collisions between the player and goblins
      if (checkPlayerGoblinCollision()) {
        endGame(); // Handle the game over state
        return; // Stop the update loop
      }
    }
    animationFrameId = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the main charactor
    const pos = position();
    ctx.drawImage(thorImage, pos.x, pos.y, size.width, size.height);

    // Draw the bullets
    ctx.fillStyle = '#ff0000';
    bullets().forEach((bullet) => {
      ctx.fillRect(bullet.x, bullet.y, bulletSize.width, bulletSize.height);
    });

    // Draw the enemy goblins
    ctx.fillStyle = '#ff00ff';
    enemies().forEach((enemy) => {
      ctx.drawImage(
        goblinImage,
        enemy.x,
        enemy.y,
        enemy.size.width,
        enemy.size.height
      );
    });

    if (isPaused()) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
    }
  };

  const shootBullet = (mouseX, mouseY) => {
    const pos = position();
    const angle = Math.atan2(
      mouseY - (pos.y + size.height / 2),
      mouseX - (pos.x + size.width / 2)
    );
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    setBullets((prevBullets) => [
      ...prevBullets,
      {
        x: pos.x + size.width / 2 - bulletSize.width / 2,
        y: pos.y + size.height / 2 - bulletSize.height / 2,
        direction,
        speed: bulletSpeed,
      },
    ]);
  };

  const handleMouseDown = (e) => {
    if (isPaused()) return;
    thorImage.src = ThorTalking;
    shootBullet(e.clientX, e.clientY);
  };

  const handleMouseUp = (e) => {
    thorImage.src = ThorNormal;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      togglePause();
    } else if (e.key === ' ' && isGameOver()) {
      // Check if space is pressed and the game is over
      resetGame();
    }
  };

  onCleanup(() => {
    cancelAnimationFrame(animationFrameId);
    clearInterval(enemySpawnInterval);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
  });

  // Start the animation loop
  animationFrameId = requestAnimationFrame(update);

  const handleResize = () => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    draw();
  };

  function spawnEnemy() {
    // if the game is paused, we don't want to spawn any new goblins
    if (isPaused() || isGameOver()) return;
    const enemySize = { width: 100, height: 100 };
    const maxEnemySpeed = 2;
    const minEnemySpeed = 1;
    const minDistance = 400;
    // if there are more than 20 enemies, we don't want to summon new ones

    if (enemies().length < 20) {
      let randomX, randomY, distance;
      const playerPos = position();
      const playerCenterX = playerPos.x + size.width / 2;
      const playerCenterY = playerPos.y + size.height / 2;

      // Keep generating random positions until the enemy is at least 400px away from the player
      do {
        randomX = Math.random() * (window.innerWidth - enemySize.width);
        randomY = Math.random() * (window.innerHeight - enemySize.height);
        const enemyCenterX = randomX + enemySize.width / 2;
        const enemyCenterY = randomY + enemySize.height / 2;
        const dx = enemyCenterX - playerCenterX;
        const dy = enemyCenterY - playerCenterY;
        distance = Math.sqrt(dx * dx + dy * dy);
      } while (distance < minDistance);

      const angle = Math.random() * Math.PI * 2;
      const speed =
        Math.random() * (maxEnemySpeed - minEnemySpeed) + minEnemySpeed;
      const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      };

      setEnemies((prevEnemies) => [
        ...prevEnemies,
        {
          x: randomX,
          y: randomY,
          size: enemySize,
          velocity: velocity,
        },
      ]);
    }
  }

  // the function below updates the goblins direction every frame so they keep moving.
  const updateGoblins = () => {
    setEnemies((prevEnemies) => {
      return prevEnemies.map((enemy) => {
        // Update the enemy's position based on its velocity
        let newX = enemy.x + enemy.velocity.x;
        let newY = enemy.y + enemy.velocity.y;

        // The blow code makes the goblins bounce off the walls so they don't go off screen
        if (newX < 0 || newX > window.innerWidth - enemy.size.width) {
          enemy.velocity.x *= -1;
          newX = Math.max(
            0,
            Math.min(newX, window.innerWidth - enemy.size.width)
          );
        }
        if (newY < 0 || newY > window.innerHeight - enemy.size.height) {
          enemy.velocity.y *= -1;
          newY = Math.max(
            0,
            Math.min(newY, window.innerHeight - enemy.size.height)
          );
        }

        return { ...enemy, x: newX, y: newY };
      });
    });
  };

  // interval to spawn enemy squares every second
  const enemySpawnInterval = setInterval(spawnEnemy, 1000);

  // Function to check for bullet-enemy collisions
  const handleCollisions = () => {
    const newBullets = bullets();
    const newEnemies = enemies().filter((enemy) => {
      // Assume no collision for this enemy
      let collided = false;

      for (let i = newBullets.length - 1; i >= 0; i--) {
        const bullet = newBullets[i];
        // Collision detection logic - check if bullet coordinates are within enemy coordinates
        if (
          bullet.x < enemy.x + enemy.size.width &&
          bullet.x + bulletSize.width > enemy.x &&
          bullet.y < enemy.y + enemy.size.height &&
          bullet.y + bulletSize.height > enemy.y
        ) {
          // Collision detected - remove the bullet and flag the enemy as collided
          newBullets.splice(i, 1);
          collided = true;
          break; // Stop checking further bullets for this enemy
        }
      }

      // Return false if this enemy was hit by a bullet (to filter it out)
      return !collided;
    });

    // Update our signals with the new arrays
    setBullets(newBullets);
    setEnemies(newEnemies);
  };

  // check for player and goblin collision, if there is we want to end the game
  const checkPlayerGoblinCollision = () => {
    const playerPos = position();
    const playerRect = {
      x: playerPos.x,
      y: playerPos.y,
      width: size.width,
      height: size.height,
    };

    for (const enemy of enemies()) {
      const collisionBoxBuffer = 35;

      const enemyRect = {
        x: enemy.x + collisionBoxBuffer,
        y: enemy.y + collisionBoxBuffer,
        width: enemy.size.width - collisionBoxBuffer * 2,
        height: enemy.size.height - collisionBoxBuffer * 2,
      };

      if (rectsOverlap(playerRect, enemyRect)) {
        return true; // Collision detected
      }
    }

    return false; // No collision
  };

  const rectsOverlap = (rect1, rect2) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  const resetGame = () => {
    // Reset game state
    setPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    setVelocity({ x: 0, y: 0 });
    setEnemies([]);
    setBullets([]);
    setIsPaused(false);
    setIsGameOver(false); // Set the game over state to false

    // reset the bullets and enimies
    setBullets([]);
    setEnemies([]);

    // Start the game loop again
    animationFrameId = requestAnimationFrame(update);
  };

  return (
    <canvas
      id="gameCanvas"
      width={windowSize().width}
      height={windowSize().height}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style="position: absolute; top: 0; left: 0; background-color: #444; overflow: hidden;"
    ></canvas>
  );
}

export default App;
