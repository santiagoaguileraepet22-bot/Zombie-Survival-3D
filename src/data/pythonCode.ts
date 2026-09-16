/**
 * Código completo en Python listo para ejecutar con Ursina Engine.
 * Este script implementa todas las mecánicas requeridas:
 * - Vista en 3ª persona fluida con rotación de mouse / teclas.
 * - Jugador con movimiento WASD, disparo proyectil/raycast y barra de vida.
 * - Zombies con persecución inteligente hacia el jugador, retroalimentación de daño y oleadas crecientes.
 * - Interfaz gráfica completa (HUD de salud, oleada, zombies eliminados y Game Over con reinicio).
 */

export const PYTHON_CODE = `"""
==============================================================================
   ZOMBIE SURVIVAL 3D - PROTOTIPO EN TERCERA PERSONA CON URSINA ENGINE
==============================================================================
Requisitos:
    pip install ursina

Ejecución:
    python zombie_survival_3d.py

Controles:
    - W, A, S, D       : Mover al personaje
    - Ratón / Mouse     : Rotar cámara en 3ª persona (Orbit / Rotación)
    - Clic Izquierdo    : Disparar hacia donde apunta la mira
    - Teclas 1, 2, 3, 4 : Cambiar arma (1: Pistola, 2: Escopeta, 3: Fusil, 4: Lanzacohetes)
    - Espacio (Space)   : Saltar
    - Shift Izquierdo   : Correr (Sprint)
    - Tecla R           : Reiniciar partida en Game Over / Recargar
    - Tecla Escape      : Bloquear / Desbloquear cursor
==============================================================================
"""

from ursina import *
from random import uniform, choice
import math

# -----------------------------------------------------------------------------
# 1. CLASE BALA / PROYECTIL
# -----------------------------------------------------------------------------
class Bullet(Entity):
    """
    Representa el proyectil disparado por el jugador.
    Soporta munición balística convencional y cohetes explosivos con área de daño (splash).
    """
    def __init__(self, position, direction, damage=35, speed=55, lifetime=2.5, is_rocket=False, splash_radius=6.0, bullet_color=color.gold):
        super().__init__(
            model='cylinder' if is_rocket else 'sphere',
            color=color.red if is_rocket else bullet_color,
            scale=(0.15, 0.6, 0.15) if is_rocket else 0.2,
            position=position,
            collider='sphere'
        )
        self.direction = direction.normalized()
        self.damage = damage
        self.speed = speed
        self.lifetime = lifetime
        self.is_rocket = is_rocket
        self.splash_radius = splash_radius
        self.time_alive = 0.0

        if is_rocket:
            self.look_at(self.position + self.direction)
            self.trail = Entity(parent=self, model='sphere', scale=0.4, color=color.orange)
        else:
            # Efecto de brillo / estela
            self.trail = Entity(parent=self, model='cylinder', scale=(0.1, 1.2, 0.1), 
                                rotation_x=90, color=bullet_color)

    def explode(self):
        """Detona un cohete generando daño radial en todos los zombies cercanos."""
        create_hit_particles(self.position, color.orange, count=25)
        create_hit_particles(self.position, color.yellow, count=15)
        create_hit_particles(self.position, color.dark_gray, count=10)

        # Daño radial (Splash Damage)
        for entity in scene.entities:
            if hasattr(entity, 'is_zombie') and entity.is_zombie:
                dist = distance(self.position, entity.position)
                if dist <= self.splash_radius:
                    falloff = 1.0 - (dist / self.splash_radius)
                    dmg = int(self.damage * max(0.35, falloff))
                    entity.take_damage(dmg)
                    # Empuje hacia afuera
                    push_dir = (entity.position - self.position).normalized()
                    entity.position += push_dir * 1.5 * falloff
        destroy(self)

    def update(self):
        # Mover la bala hacia adelante según su dirección
        dt = time.dt
        self.position += self.direction * self.speed * dt
        self.time_alive += dt

        # Si es cohete y toca el suelo
        if self.is_rocket and self.y <= 0.2:
            self.explode()
            return

        # Destruir tras superar tiempo de vida
        if self.time_alive >= self.lifetime:
            if self.is_rocket:
                self.explode()
            else:
                destroy(self)
            return

        # Chequeo de colisión manual con entidades zombies
        hit_info = self.intersects()
        if hit_info.hit and hit_info.entity:
            target = hit_info.entity
            if self.is_rocket:
                self.explode()
                return

            if hasattr(target, 'is_zombie') and target.is_zombie:
                target.take_damage(self.damage)
                # Crear efecto de chispas/sangre
                create_hit_particles(self.position, color.red)
                destroy(self)
            elif target != self and not hasattr(target, 'is_player'):
                # Chispas al impactar obstáculos
                create_hit_particles(self.position, color.smoke)
                destroy(self)


# -----------------------------------------------------------------------------
# 2. CLASE JUGADOR (PLAYER)
# -----------------------------------------------------------------------------
class Player(Entity):
    """
    Entidad controlada por el usuario con cámara en tercera persona integrada.
    Soporta movimiento omnidireccional, rotación horizontal desacoplada de la cámara
    y sistema de disparo apuntando hacia el centro de la pantalla.
    """
    def __init__(self, position=(0, 1, 0)):
        super().__init__(
            position=position,
            collider='box'
        )
        self.is_player = True

        # Modelo visual del personaje (cuerpo principal estilo low-poly)
        self.body = Entity(parent=self, model='cube', scale=(0.9, 1.8, 0.6), 
                           color=color.rgb(40, 110, 200), position=(0, 0.9, 0))
        # Cabeza
        self.head = Entity(parent=self, model='sphere', scale=0.6, 
                           color=color.rgb(240, 195, 160), position=(0, 2.0, 0))
        # Arma en la mano derecha
        self.gun = Entity(parent=self, model='cube', scale=(0.15, 0.18, 0.9), 
                          color=color.rgb(30, 30, 30), position=(0.55, 1.1, 0.6))
        # Punta del cañón para el spawn de balas
        self.gun_barrel = Entity(parent=self.gun, position=(0, 0, 0.55))

        # Atributos del jugador
        self.max_health = 100
        self.health = 100
        self.walk_speed = 7.0
        self.run_speed = 12.0
        self.current_speed = self.walk_speed
        self.is_alive = True
        self.last_shot_time = 0.0

        # Arsenal de armas disponibles
        self.weapons = {
            '1': {'name': 'Pistola Táctica', 'damage': 38, 'rate': 0.22, 'speed': 65, 'pellets': 1, 'spread': 0.0, 'color': color.gold, 'scale': (0.15, 0.18, 0.8), 'model_color': color.rgb(40, 40, 40)},
            '2': {'name': 'Escopeta de Trinchera', 'damage': 24, 'rate': 0.75, 'speed': 55, 'pellets': 6, 'spread': 0.12, 'color': color.orange, 'scale': (0.18, 0.22, 1.2), 'model_color': color.rgb(80, 50, 30)},
            '3': {'name': 'Fusil de Asalto', 'damage': 30, 'rate': 0.09, 'speed': 80, 'pellets': 1, 'spread': 0.03, 'color': color.cyan, 'scale': (0.14, 0.25, 1.3), 'model_color': color.rgb(30, 40, 35)},
            '4': {'name': 'Lanzacohetes RPG', 'damage': 220, 'rate': 1.4, 'speed': 40, 'pellets': 1, 'spread': 0.0, 'is_rocket': True, 'splash': 7.0, 'scale': (0.24, 0.24, 1.6), 'model_color': color.rgb(50, 70, 50)},
        }
        self.current_weapon_key = '1'
        self.current_weapon = self.weapons[self.current_weapon_key]

        # Física simple
        self.velocity_y = 0.0
        self.gravity = 25.0
        self.jump_power = 9.0
        self.is_grounded = True

    def change_weapon(self, key):
        """Cambia el arma activa y adapta el modelo visual y cadencia."""
        if key in self.weapons and key != self.current_weapon_key:
            self.current_weapon_key = key
            self.current_weapon = self.weapons[key]
            self.gun.scale = self.current_weapon['scale']
            self.gun.color = self.current_weapon['model_color']
            if hasattr(game, 'update_weapon_ui'):
                game.update_weapon_ui(self.current_weapon['name'], key)

    def update(self):
        if not self.is_alive:
            return

        dt = time.dt

        # Selección de armas con teclas numéricas 1, 2, 3, 4
        if held_keys['1']: self.change_weapon('1')
        if held_keys['2']: self.change_weapon('2')
        if held_keys['3']: self.change_weapon('3')
        if held_keys['4']: self.change_weapon('4')

        # 1. Movimiento en base a W, A, S, D relativo al ángulo de la cámara
        cam_yaw = math.radians(game.camera_pivot.rotation_y)
        forward = Vec3(math.sin(cam_yaw), 0, math.cos(cam_yaw)).normalized()
        right = Vec3(math.cos(cam_yaw), 0, -math.sin(cam_yaw)).normalized()

        move_dir = Vec3(0, 0, 0)
        if held_keys['w']: move_dir += forward
        if held_keys['s']: move_dir -= forward
        if held_keys['d']: move_dir += right
        if held_keys['a']: move_dir -= right

        # Sprint con Shift
        if held_keys['left shift']:
            self.current_speed = self.run_speed
        else:
            self.current_speed = self.walk_speed

        if move_dir.length() > 0.01:
            move_dir = move_dir.normalized()
            self.position += move_dir * self.current_speed * dt
            
            # Rotar el personaje suavemente hacia la dirección en que se desplaza
            target_rot = math.degrees(math.atan2(move_dir.x, move_dir.z))
            self.rotation_y = lerp(self.rotation_y, target_rot, dt * 14)

        # 2. Salto y Gravedad
        if self.is_grounded and held_keys['space']:
            self.velocity_y = self.jump_power
            self.is_grounded = False

        self.velocity_y -= self.gravity * dt
        self.y += self.velocity_y * dt

        # Suelo en Y = 0
        if self.y <= 0:
            self.y = 0
            self.velocity_y = 0
            self.is_grounded = True

        # 3. Disparo con Clic Izquierdo (Mouse 0)
        if held_keys['left mouse'] and (time.time() - self.last_shot_time) >= self.current_weapon['rate']:
            self.shoot()

    def shoot(self):
        """Dispara proyectiles en la dirección hacia donde apunta la cámara."""
        self.last_shot_time = time.time()
        w = self.current_weapon
        
        # Dirección de cámara
        cam_rot = game.camera_pivot.rotation_y
        cam_pitch = game.camera_pivot.rotation_x
        rad_yaw = math.radians(cam_rot)
        rad_pitch = math.radians(cam_pitch)

        spawn_pos = self.gun_barrel.world_position

        # Si Aimlock está activo y hay un enemigo fijado, enfocar disparo al pecho
        if game.locked_zombie and game.locked_zombie.is_alive:
            target_pt = game.locked_zombie.position + Vec3(0, 1.2, 0)
            base_dir = (target_pt - spawn_pos).normalized()
        else:
            base_dir = Vec3(
                math.sin(rad_yaw) * math.cos(rad_pitch),
                -math.sin(rad_pitch),
                math.cos(rad_yaw) * math.cos(rad_pitch)
            ).normalized()

        if w.get('is_rocket', False):
            # Proyectil Cohete RPG
            Bullet(position=spawn_pos, direction=base_dir, damage=w['damage'],
                   speed=w['speed'], is_rocket=True, splash_radius=w['splash'])
        else:
            # Balística (Pistola, Escopeta, Fusil)
            pellets = w.get('pellets', 1)
            spread = w.get('spread', 0.0)
            spread_factor = 0.35 if game.locked_zombie else 1.0
            for _ in range(pellets):
                shoot_dir = Vec3(
                    base_dir.x + uniform(-spread, spread) * spread_factor,
                    base_dir.y + uniform(-spread, spread) * 0.8 * spread_factor,
                    base_dir.z + uniform(-spread, spread) * spread_factor
                ).normalized()
                Bullet(position=spawn_pos, direction=shoot_dir, damage=w['damage'],
                       speed=w['speed'], bullet_color=w['color'])

        # Efecto de retroceso visual y fogonazo
        self.gun.position = Vec3(0.55, 1.1, 0.4)
        self.gun.animate_position(Vec3(0.55, 1.1, 0.6), duration=0.08)
        flash = Entity(parent=self.gun_barrel, model='sphere', scale=0.35, 
                       color=color.orange if not w.get('is_rocket') else color.yellow, unlit=True)
        destroy(flash, delay=0.05)

    def take_damage(self, amount):
        """Aplica daño al jugador y actualiza la interfaz gráfica."""
        if not self.is_alive:
            return

        self.health -= amount
        self.health = max(0, self.health)
        game.update_health_ui(self.health, self.max_health)

        # Parpadeo rojo en pantalla al recibir daño
        game.trigger_damage_flash()

        if self.health <= 0:
            self.die()

    def die(self):
        """Maneja la muerte del personaje y activa Game Over."""
        self.is_alive = False
        # Animación de caída
        self.animate_rotation_x(85, duration=0.5)
        self.animate_position_y(0.4, duration=0.5)
        game.trigger_game_over()


# -----------------------------------------------------------------------------
# 3. CLASE ZOMBIE (ENEMIGOS CON VARIEDAD DE MUTACIONES)
# -----------------------------------------------------------------------------
class Zombie(Entity):
    """
    Representa a cada enemigo zombie con IA de persecución hacia el jugador.
    Soporta múltiples mutaciones:
    - 'walker': Caminante clásico balanceado
    - 'runner': Corredor ágil y veloz con menor resistencia
    - 'tank': Coloso mutante gigantesco con alta vida e impacto arrollador
    - 'toxic': Mutación química verde lima que estalla al morir
    """
    def __init__(self, position, zombie_type='walker'):
        super().__init__(
            position=position,
            collider='box'
        )
        self.is_zombie = True
        self.zombie_type = zombie_type
        self.is_alive = True
        self.last_attack_time = 0.0

        # Configuración según arquetipo
        if zombie_type == 'runner':
            self.max_health = 60
            self.speed = uniform(6.8, 8.2)
            self.damage = 10
            self.attack_cooldown = 0.65
            self.scale = 0.88
            self.body_color = color.rgb(180, 80, 45) # Rojizo / Infectado veloz
            self.head_color = color.rgb(200, 95, 55)
            self.eye_color = color.red
        elif zombie_type == 'tank':
            self.max_health = 320
            self.speed = uniform(2.2, 3.0)
            self.damage = 38
            self.attack_cooldown = 1.6
            self.scale = 1.45 # Coloso macizo
            self.body_color = color.rgb(65, 75, 80) # Grisáceo oscuro / Blindado
            self.head_color = color.rgb(80, 90, 95)
            self.eye_color = color.orange
        elif zombie_type == 'toxic':
            self.max_health = 75
            self.speed = uniform(3.8, 4.6)
            self.damage = 16
            self.attack_cooldown = 0.9
            self.scale = 0.98
            self.body_color = color.rgb(130, 205, 30) # Verde radioactivo / Ácido
            self.head_color = color.rgb(155, 230, 45)
            self.eye_color = color.lime
        else: # 'walker' estándar
            self.max_health = 100
            self.speed = uniform(3.2, 4.8)
            self.damage = 16
            self.attack_cooldown = 1.0
            self.scale = 1.0
            self.body_color = color.rgb(45, 120, 50) # Verde putrefacto
            self.head_color = color.rgb(60, 140, 65)
            self.eye_color = color.yellow

        self.health = self.max_health

        # Cuerpo del Zombie
        self.body = Entity(parent=self, model='cube', scale=(0.85, 1.8, 0.6), 
                           color=self.body_color, position=(0, 0.9, 0))
        # Cabeza
        self.head = Entity(parent=self, model='sphere', scale=0.55, 
                           color=self.head_color, position=(0, 2.0, 0))
        # Ojos brillantes
        self.eye1 = Entity(parent=self.head, model='sphere', scale=0.12, 
                           color=self.eye_color, position=(-0.16, 0.08, 0.25))
        self.eye2 = Entity(parent=self.head, model='sphere', scale=0.12, 
                           color=self.eye_color, position=(0.16, 0.08, 0.25))
        # Brazos extendidos hacia adelante en pose de ataque
        self.arm1 = Entity(parent=self, model='cube', scale=(0.18, 0.18, 0.8), 
                           color=self.body_color, position=(-0.45, 1.2, 0.4))
        self.arm2 = Entity(parent=self, model='cube', scale=(0.18, 0.18, 0.8), 
                           color=self.body_color, position=(0.45, 1.2, 0.4))

    def update(self):
        if not self.is_alive or not game.player.is_alive:
            return

        dt = time.dt
        player_pos = game.player.position

        # Calcular dirección y distancia hacia el jugador
        diff = player_pos - self.position
        diff.y = 0  # Mantenerse en el plano horizontal
        dist = diff.length()

        # Mirar hacia el jugador
        if dist > 0.1:
            self.look_at_2d(player_pos)

        # Si está lejos, perseguir; si está a rango de golpe, atacar
        if dist > 1.6:
            move_vec = diff.normalized() * self.speed * dt
            self.position += move_vec
            # Ligera oscilación al caminar
            self.rotation_z = math.sin(time.time() * 8) * 4
        else:
            # Rango de ataque
            if (time.time() - self.last_attack_time) >= self.attack_cooldown:
                self.attack_player()

    def attack_player(self):
        """Ataca e inflige daño al jugador."""
        self.last_attack_time = time.time()
        # Animación de zarpazo
        self.arm1.animate_rotation_x(-40, duration=0.15)
        self.arm2.animate_rotation_x(-40, duration=0.15)
        invoke(lambda: self.reset_arms(), delay=0.2)
        game.player.take_damage(self.damage)

    def reset_arms(self):
        self.arm1.rotation_x = 0
        self.arm2.rotation_x = 0

    def take_damage(self, amount):
        """Aplica daño y genera retroalimentación visual (parpadeo rojo)."""
        if not self.is_alive:
            return

        self.health -= amount
        # Retroceso leve por impacto
        push_back = (self.position - game.player.position).normalized() * 0.4
        push_back.y = 0
        self.position += push_back

        # Feedback visual: cambiar a rojo brillante momentáneamente
        self.body.color = color.red
        self.head.color = color.red
        invoke(lambda: self.restore_color(), delay=0.12)

        if self.health <= 0:
            self.die()

    def restore_color(self):
        if self.is_alive:
            self.body.color = self.body_color
            self.head.color = color.rgb(60, 140, 65)

    def die(self):
        """Muerte del zombie: animación, efectos y explosión si es tóxico."""
        self.is_alive = False
        self.collider = None
        game.zombies_killed += 1
        game.update_hud()

        # Si era tipo tóxico, estalla en ácido
        if self.zombie_type == 'toxic':
            create_hit_particles(self.position + Vec3(0, 1, 0), color.lime, count=24)
            # Daño en área por veneno
            for e in scene.entities:
                if hasattr(e, 'is_zombie') and e != self and e.is_alive:
                    if distance(e.position, self.position) < 5.0:
                        e.take_damage(45)
            if distance(game.player.position, self.position) < 5.0:
                game.player.take_damage(20)
        else:
            p_color = color.orange if self.zombie_type == 'tank' else color.red
            create_hit_particles(self.position + Vec3(0, 1, 0), p_color, count=14)

        # Animación de caída hacia atrás y fade out
        self.animate_rotation_x(-90, duration=0.3)
        self.animate_position_y(0.1, duration=0.3)
        destroy(self, delay=0.45)


# -----------------------------------------------------------------------------
# 4. SISTEMA DE PARTÍCULAS / EFECTOS VISUALES
# -----------------------------------------------------------------------------
def create_hit_particles(pos, p_color, count=8):
    """Genera partículas efímeras para impactos de balas y derrotas."""
    for _ in range(count):
        vel = Vec3(uniform(-3, 3), uniform(1, 5), uniform(-3, 3))
        p = Entity(
            model='cube',
            scale=uniform(0.08, 0.18),
            color=p_color,
            position=pos
        )
        p.animate_position(p.position + vel, duration=0.4, curve=curve.out_quad)
        p.animate_scale(0, duration=0.4)
        destroy(p, delay=0.4)


# -----------------------------------------------------------------------------
# 5. CONTROLADOR PRINCIPAL DEL JUEGO (GAME)
# -----------------------------------------------------------------------------
class Game:
    """
    Administrador central del ciclo de vida del juego:
    - Inicializa el entorno 3D (escenario, luces, obstáculos).
    - Administra la cámara en 3ª persona (orbital/smooth follow).
    - Genera oleadas progresivas de zombies desde la periferia.
    - Controla el HUD (vida, bajas, oleadas, pantalla Game Over).
    """
    def __init__(self):
        # 1. Configuración de la ventana y ratón
        window.title = "Zombie Survival 3D - Ursina Engine"
        window.borderless = False
        window.fullscreen = False
        window.exit_button.visible = False
        window.fps_counter.enabled = True
        mouse.locked = True
        mouse.visible = False

        # Estado del juego
        self.score = 0
        self.zombies_killed = 0
        self.current_wave = 1
        self.zombies_in_wave = 6
        self.spawned_in_wave = 0
        self.spawn_timer = 0.0
        self.spawn_interval = 1.4
        self.game_over = False

        # 2. Creación del Entorno 3D
        self.create_environment()

        # 3. Inicializar Jugador
        self.player = Player(position=(0, 0, 0))

        # 4. Rig de Cámara en Tercera Persona
        # Pivot centrado en el jugador que rota con el mouse
        self.camera_pivot = Entity(position=self.player.position)
        camera.parent = self.camera_pivot
        camera.position = (0, 3.2, -7.5)   # Offset detrás y arriba del jugador
        camera.rotation_x = 18             # Mirar ligeramente hacia abajo
        self.cam_sens = 40.0

        # 5. Sistema de Fijación Automática (Aimlock)
        self.aimlock_enabled = False
        self.locked_zombie = None
        self.aimlock_reticle = Entity(
            model='wireframe_cube', 
            scale=1.4, 
            color=color.red, 
            enabled=False
        )

        # 6. Elementos de Interfaz de Usuario (UI)
        self.create_ui()

    def create_environment(self):
        """Construye el suelo, iluminación de ambiente y obstáculos para cobertura."""
        # Suelo grande con patrón de cuadrícula
        self.ground = Entity(
            model='plane',
            scale=(140, 1, 140),
            color=color.rgb(38, 45, 38),
            texture='white_cube',
            texture_scale=(70, 70),
            collider='box'
        )

        # Luz direccional y ambiental
        DirectionalLight(rotation=(45, -30, 45), color=color.rgb(255, 240, 220))
        AmbientLight(color=color.rgb(70, 75, 85))

        # Obstáculos / Cajas para ambientar la arena de combate
        for _ in range(25):
            rx = choice([-1, 1]) * uniform(8, 45)
            rz = choice([-1, 1]) * uniform(8, 45)
            s = uniform(1.5, 3.2)
            Entity(
                model='cube',
                color=color.rgb(85, 70, 55),
                scale=(s, s, s),
                position=(rx, s / 2, rz),
                collider='box'
            )

    def create_ui(self):
        """Configura el HUD sobre la pantalla."""
        # Retícula / Mira central
        Entity(parent=camera.ui, model='quad', scale=0.008, color=color.white)

        # Fondo de la barra de vida
        self.hp_bg = Entity(parent=camera.ui, model='quad', scale=(0.35, 0.035), 
                            position=(-0.65, 0.44), color=color.rgb(40, 40, 40))
        # Relleno de la barra de vida
        self.hp_fill = Entity(parent=camera.ui, model='quad', scale=(0.34, 0.028), 
                              position=(-0.65, 0.44), color=color.rgb(220, 40, 40))

        # Textos informativos
        self.hp_text = Text(text="SALUD: 100%", position=(-0.82, 0.48), 
                            scale=1.2, color=color.white)
        self.kills_text = Text(text="ZOMBIES ELIMINADOS: 0", position=(-0.82, 0.40), 
                               scale=1.1, color=color.yellow)
        self.wave_text = Text(text="OLEADA: 1", position=(0.60, 0.44), 
                              scale=1.3, color=color.cyan)
        self.weapon_text = Text(text="ARMA: [1] Pistola Táctica", position=(-0.82, -0.44), 
                                scale=1.1, color=color.rgb(250, 200, 80))

        # Flash de daño (pantalla roja translúcida)
        self.damage_flash = Entity(parent=camera.ui, model='quad', scale=(2, 2), 
                                   color=color.rgba(255, 0, 0, 0))

        # Panel de Game Over (oculto inicialmente)
        self.game_over_panel = Entity(parent=camera.ui, model='quad', scale=(0.75, 0.45), 
                                      color=color.rgba(15, 15, 15, 0.92), enabled=False)
        self.go_title = Text(parent=self.game_over_panel, text="HAS MUERTO", 
                             position=(-0.24, 0.12), scale=2.4, color=color.red)
        self.go_sub = Text(parent=self.game_over_panel, 
                           text="Presiona [R] para reiniciar partida", 
                           position=(-0.30, -0.06), scale=1.2, color=color.white)

    def update(self):
        """Ciclo principal de actualización llamado por Ursina."""
        dt = time.dt

        # Control de ratón para rotación de cámara en 3ª persona
        if mouse.locked and not self.game_over:
            # Rotación horizontal (Yaw)
            self.camera_pivot.rotation_y += mouse.velocity[0] * self.cam_sens
            # Rotación vertical (Pitch) con tope para no invertir la vista
            self.camera_pivot.rotation_x -= mouse.velocity[1] * self.cam_sens
            self.camera_pivot.rotation_x = clamp(self.camera_pivot.rotation_x, -10, 45)

        # Sistema de Fijación Automática Aimlock (Seguimiento automático)
        is_aimlock = self.aimlock_enabled or held_keys['right mouse']
        if is_aimlock and not self.game_over and self.player.is_alive:
            best_target = None
            best_dist = 45.0

            for e in scene.entities:
                if hasattr(e, 'is_zombie') and e.is_alive:
                    d = distance(self.player.position, e.position)
                    if d < best_dist:
                        best_dist = d
                        best_target = e

            self.locked_zombie = best_target
            if best_target:
                self.aimlock_reticle.enabled = True
                self.aimlock_reticle.position = best_target.position + Vec3(0, 1.2, 0)
                self.aimlock_reticle.rotation_y += dt * 180

                # Seguimiento suave de la cámara hacia el objetivo
                to_target = (best_target.position + Vec3(0, 1.2, 0)) - self.camera_pivot.position
                target_yaw = math.degrees(math.atan2(to_target.x, to_target.z))
                diff_yaw = (target_yaw - self.camera_pivot.rotation_y + 180) % 360 - 180
                self.camera_pivot.rotation_y += diff_yaw * min(1.0, dt * 14)

                # Orientar al jugador directamente al blanco
                self.player.rotation_y = lerp(self.player.rotation_y, target_yaw, dt * 16)
            else:
                self.aimlock_reticle.enabled = False
        else:
            self.locked_zombie = None
            self.aimlock_reticle.enabled = False

        # La cámara sigue suavemente al jugador (Smooth lerp)
        target_pos = self.player.position + Vec3(0, 1.2, 0)
        self.camera_pivot.position = lerp(self.camera_pivot.position, target_pos, dt * 16)

        # Spawneo de oleadas
        if not self.game_over and self.player.is_alive:
            self.spawn_timer += dt
            if self.spawn_timer >= self.spawn_interval and self.spawned_in_wave < self.zombies_in_wave:
                self.spawn_timer = 0
                self.spawn_zombie()

            # Avanzar a la siguiente oleada cuando se hayan generado y eliminado todos
            active_zombies = [e for e in scene.entities if hasattr(e, 'is_zombie') and e.is_alive]
            if self.spawned_in_wave >= self.zombies_in_wave and len(active_zombies) == 0:
                self.next_wave()

    def spawn_zombie(self):
        """Genera un zombie con mutación adaptada a la oleada actual."""
        angle = uniform(0, math.pi * 2)
        dist = uniform(22, 38)
        px = self.player.x + math.cos(angle) * dist
        pz = self.player.z + math.sin(angle) * dist

        r = random()
        if self.current_wave >= 4 and r < 0.20:
            z_type = 'tank'
        elif self.current_wave >= 3 and r < 0.40:
            z_type = 'toxic'
        elif self.current_wave >= 2 and r < 0.65:
            z_type = 'runner'
        else:
            z_type = 'walker'

        Zombie(position=Vec3(px, 0, pz), zombie_type=z_type)
        self.spawned_in_wave += 1

    def next_wave(self):
        """Incrementa la dificultad y cantidad de enemigos."""
        self.current_wave += 1
        self.zombies_in_wave = int(self.zombies_in_wave * 1.5) + 2
        self.spawned_in_wave = 0
        self.spawn_interval = max(0.5, self.spawn_interval * 0.9)
        self.update_hud()
        
        # Notificación en pantalla
        wave_announcement = Text(
            text=f"¡OLEADA {self.current_wave} COMIENZA!", 
            position=(-0.25, 0.15), 
            scale=1.8, 
            color=color.orange
        )
        destroy(wave_announcement, delay=2.5)

    def update_health_ui(self, current, maximum):
        """Actualiza el porcentaje y ancho visual de la barra de vida."""
        ratio = max(0.0, current / maximum)
        self.hp_fill.scale_x = 0.34 * ratio
        self.hp_text.text = f"SALUD: {int(current)}%"

    def update_hud(self):
        """Refresca los contadores de oleada y eliminaciones."""
        self.kills_text.text = f"ZOMBIES ELIMINADOS: {self.zombies_killed}"
        self.wave_text.text = f"OLEADA: {self.current_wave}"

    def update_weapon_ui(self, weapon_name, key_num):
        """Actualiza la visualización del arma seleccionada en el HUD."""
        self.weapon_text.text = f"ARMA: [{key_num}] {weapon_name}"

    def trigger_damage_flash(self):
        """Efecto de parpadeo rojo cuando el personaje recibe un golpe."""
        self.damage_flash.color = color.rgba(255, 0, 0, 0.45)
        self.damage_flash.animate('color', color.rgba(255, 0, 0, 0), duration=0.35)

    def trigger_game_over(self):
        """Muestra la pantalla de derrota y desbloquea el ratón."""
        self.game_over = True
        mouse.locked = False
        mouse.visible = True
        self.game_over_panel.enabled = True

    def restart(self):
        """Reinicia la escena y variables para una nueva partida."""
        # Limpiar zombies y balas restantes
        for e in list(scene.entities):
            if hasattr(e, 'is_zombie') or isinstance(e, Bullet):
                destroy(e)

        self.game_over = False
        self.zombies_killed = 0
        self.current_wave = 1
        self.zombies_in_wave = 6
        self.spawned_in_wave = 0
        self.spawn_timer = 0
        self.game_over_panel.enabled = False

        # Restaurar jugador
        self.player.health = self.player.max_health
        self.player.is_alive = True
        self.player.position = (0, 0, 0)
        self.player.rotation = (0, 0, 0)
        self.player.body.color = color.rgb(40, 110, 200)

        self.update_health_ui(self.player.health, self.player.max_health)
        self.update_hud()
        mouse.locked = True
        mouse.visible = False


# -----------------------------------------------------------------------------
# 6. ENTRADA DE EVENTOS Y BUCLE GLOBAL
# -----------------------------------------------------------------------------
# Inicializar Ursina Engine
app = Ursina()

# Instanciar el juego
game = Game()

def update():
    """Función global de ciclo que Ursina ejecuta en cada frame."""
    game.update()

def input(key):
    """Manejador global de eventos de teclado y ratón."""
    # Alternar fijación automática Aimlock con tecla E o F
    if key in ('e', 'f'):
        game.aimlock_enabled = not game.aimlock_enabled
        st = "ACTIVADO" if game.aimlock_enabled else "DESACTIVADO"
        col = color.red if game.aimlock_enabled else color.gray
        msg = Text(text=f"AIMLOCK: {st}", position=(-0.15, 0.35), scale=1.3, color=col)
        destroy(msg, delay=1.2)

    # Cambio rápido de armas numérico
    if key in ('1', '2', '3', '4'):
        w_map = {'1': 'pistol', '2': 'shotgun', '3': 'rifle', '4': 'rocket'}
        game.player.equip_weapon(w_map[key])

    # Alternar bloqueo de ratón con Escape
    if key == 'escape':
        mouse.locked = not mouse.locked
        mouse.visible = not mouse.locked

    # Reiniciar al presionar R si el juego ha terminado
    if key == 'r' and game.game_over:
        game.restart()

# Ejecutar aplicación
if __name__ == '__main__':
    app.run()
`;
