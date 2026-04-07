/*
@plugin 小地图
@version 1.15
@author 徐然
@link https://space.bilibili.com/291565199
@desc 

在场景加载完成后显示简易小地图，显示角色和障碍物等对象分布。
公共方法：
window.Minimap.hide() // 隐藏小地图
window.Minimap.show() // 显示小地图
window.Minimap.render() // 绘制地图
window.Minimap.setPosition(position, options) // 设置小地图位置，参数：position: 位置类型，options: 可选参数，offsetX: 偏移量X，offsetY: 偏移量Y，x: 自定义位置X，y: 自定义位置Y

@number width
@alias 小地图宽度
@default 200

@number height
@alias 小地图高度
@default 200

@number mobileIconScale
@alias 移动端图标缩放
@desc 移动端下的图标缩放比例，用于调整角色头像、图块等大小
@default 0.7

@boolean autoScale
@alias 自动缩放
@desc 开启后，小地图会根据设备类型自动调整大小
@default true

@number mobileScale
@alias 移动端缩放比例
@desc 移动端下的缩放比例，仅在自动缩放开启时生效
@default 0.7

@boolean fogEnabled
@alias 迷雾效果
@desc
开启后，小地图会显示迷雾效果，迷雾效果会根据迷雾半径和迷雾颜色来显示
存档大小也会随着迷雾效果的开启而增加，慎用！！！

@default false

@color fogColor
@alias 迷雾颜色
@default 000000ff

@number fogRadius
@alias 迷雾半径
@default 10

@option playerMode {"avatar","color"}
@alias 玩家显示 {头像,颜色}
@default avatar

@color playerColor
@alias 玩家点颜色
@default 00ff00ff
@cond playerMode {"color"}

@option memberMode {"avatar","color"}
@alias 队友显示 {头像,颜色}
@default avatar

@color memberColor
@alias 队友点颜色
@default 0000ffff
@cond memberMode {"color"}

@option enemyMode {"avatar","color"}
@alias 敌人显示 {头像,颜色}
@default avatar

@color enemyColor
@alias 敌人点颜色
@default 000000ff
@cond enemyMode {"color"}

@color triggerColor
@alias 触发器颜色
@default ffff00ff

@color obstacleColor
@alias 障碍点颜色
@default 00000000

@string[] layerColor
@alias 层级颜色
@desc 当为空时，将自行计算颜色，否则使用自定义颜色
@default ['','','']

@color borderColor
@alias 边框颜色
@default ffffffff

@number borderWidth
@alias 边框宽度
@default 2

@number minScale
@alias 最小缩放比例
@default 1

@number maxScale
@alias 最大缩放比例
@default 2

@option position {"right-top", "right-bottom","left-top","left-bottom","custom-position"}
@alias 小地图初始位置 {右上,右下,左上,左下,自定义位置}
@default right-top


@variable-number positionOffsetX
@alias 小地图X偏移
@default 0
@cond position {"right-top", "right-bottom","left-top","left-bottom"}


@variable-number positionOffsetY
@alias 小地图y偏移
@default 0
@cond position {"right-top", "right-bottom","left-top","left-bottom"}


@variable-number positionX
@alias 小地图自定义位置X
@cond position {"custom-position"}
@default 0

@variable-number positionY
@alias 小地图自定义位置Y
@cond position {"custom-position"}
@default 0

@option shape {"square","circle"}
@alias 小地图形状 {方形,圆形}
@default square
*/

export default class Minimap implements Script<Plugin> {
	width!: number;
	height!: number;
	playerColor!: string;
	enemyColor!: string;
	memberColor!: string;
	obstacleColor!: string;
	borderColor!: string;
	borderWidth!: number;
	minScale!: number;
	maxScale!: number;
	scale: number = 1;
	position!: string;
	shape!: string;
	autoScale!: boolean;
	mobileScale!: number;
	mobileIconScale!: number;
	// --- Fog of war properties ---
	fogEnabled!: boolean;
	fogColor!: string;
	fogRadius!: number;
	playerMode!: string;
	memberMode!: string;
	enemyMode!: string;

	// 脚本属性
	enabled: boolean = false;
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	positionX!: number;
	positionY!: number;
	positionOffsetX!: number;
	positionOffsetY!: number;
	colorMode!: string;
	layerColor!: string;
	triggerColor!: string;
	/** 探索记录：true 表示已探索 */
	private explored: boolean[][] = [];
	/** Fog overlay canvas */
	private fogCanvas?: HTMLCanvasElement;
	private fogCtx?: CanvasRenderingContext2D;
	/** 场景 -> 探索记录映射 */
	private exploredByScene: Map<string, boolean[][]> = new Map();
	/** 已经请求加载但尚未完成的纹理GUID集合 */
	private _loadingImages: Set<string> = new Set();
	private bgCanvas?: HTMLCanvasElement;
	private bgCtx?: CanvasRenderingContext2D;
	private bgDirty: boolean = true;

	constructor() {
		(window as any).Minimap = this;

		// ---- Patch SceneContext.saveData once ----
		const SceneContextRef: any =
			SceneContext ||
			(Scene as any).contexts?.constructor?.prototype?.constructor;
		if (SceneContextRef && !SceneContextRef.__minimapPatched) {
			const originalSaveData = SceneContextRef.prototype.saveData;
			SceneContextRef.prototype.saveData = function (this: any) {
				const data = originalSaveData.call(this);
				// 获取 Minimap 实例
				const minimap = (window as any).Minimap as Minimap | undefined;
				if (minimap) {
					const explored = minimap.exploredByScene.get(this.id);
					if (explored) {
						// 深拷贝避免后续修改影响存档
						data.minimapExplored = explored.map((row: boolean[]) =>
							row.slice(),
						);
					}
				}
				return data;
			};
			SceneContextRef.__minimapPatched = true;
		}

		// ---- Patch Data.saveGameData / loadGameData once ----
		const DataRef: any = Data;
		if (DataRef && !DataRef.__minimapPatched) {
			// Patch saveGameData
			const originalSaveGameData = DataRef.saveGameData;
			DataRef.saveGameData = async function (index: number, meta: any) {
				const minimap = (window as any).Minimap as Minimap | undefined;
				// 执行原本保存逻辑
				await originalSaveGameData.call(this, index, meta);
				if (!minimap) return;
				// 追加迷雾数据到存档文件
				const suffix = index.toString().padStart(2, "0");
				const exploredObj: { [key: string]: boolean[][] } = {};
				minimap.exploredByScene.forEach((value, key) => {
					exploredObj[key] = value;
				});
				try {
					switch (Stats.shell) {
						case "electron": {
							const path = Loader.routeSave(`Save/save${suffix}.save`);
							const fs = require("fs");
							const json = JSON.parse(fs.readFileSync(path, "utf8"));
							json.minimapExplored = exploredObj;
							fs.writeFileSync(
								path,
								Stats.debug
									? JSON.stringify(json, null, 2)
									: JSON.stringify(json),
							);
							break;
						}
						case "browser": {
							const key = `save${suffix}.save`;
							const json = await IDB.getItem(key);
							if (json) {
								json.minimapExplored = exploredObj;
								await IDB.setItem(key, json);
							}
							break;
						}
					}
				} catch (e) {
					console.warn(e);
				}
			};

			// Patch loadGameData
			const originalLoadGameData = DataRef.loadGameData;
			DataRef.loadGameData = async function (index: number) {
				const suffix = index.toString().padStart(2, "0");
				// 先读取存档文件中的迷雾数据
				let minimapData: any;
				try {
					switch (Stats.shell) {
						case "electron": {
							const path = Loader.routeSave(`Save/save${suffix}.save`);
							const fs = require("fs");
							const json = JSON.parse(fs.readFileSync(path, "utf8"));
							minimapData = json.minimapExplored;
							break;
						}
						case "browser": {
							const key = `save${suffix}.save`;
							const json = await IDB.getItem(key);
							minimapData = json?.minimapExplored;
							break;
						}
					}
				} catch (e) {
					console.warn(e);
				}

				// 调用原始加载逻辑
				await originalLoadGameData.call(this, index);

				// 加载完游戏后，将迷雾数据写回 Minimap
				if (minimapData && (window as any).Minimap) {
					const minimap = (window as any).Minimap as Minimap;
					minimap.exploredByScene = new Map<string, boolean[][]>();
					Object.keys(minimapData).forEach(sceneId => {
						minimap.exploredByScene.set(sceneId, minimapData[sceneId]);
					});
				}
			};

			DataRef.__minimapPatched = true;
		}
	}

	onStart(): void {
		// 检测是否为移动端并应用缩放
		if (this.autoScale && Stats.isMobile()) {
			this.scale = this.mobileScale;
		}

		Scene.on("load", scene => {
			this.enabled = true;
			this.createCanvas();
			this.bgCanvas = undefined;
			this.bgCtx = undefined;
			this.bgDirty = true;
			this._loadingImages.clear();
			// 载入或初始化探索记录
			let record = scene.savedData?.minimapExplored as boolean[][] | undefined;
			if (!record) record = this.exploredByScene.get(scene.id);
			if (
				!record ||
				record.length !== scene.height ||
				record[0]?.length !== scene.width
			) {
				record = Array.from({ length: scene.height }, () =>
					Array(scene.width).fill(false),
				);
				this.exploredByScene.set(scene.id, record);
			}
			this.explored = record;

			// 初始化 fogCanvas
			if (!this.fogCanvas) {
				this.fogCanvas = document.createElement("canvas");
				this.fogCanvas.width = this.width;
				this.fogCanvas.height = this.height;
				this.fogCtx = this.fogCanvas.getContext("2d")!;
				this.fogCtx.imageSmoothingEnabled = false;
			}
			// 填充全部迷雾颜色后按已探索数据清除
			this._rebuildFog(scene);

			scene.renderers.push(this);
		});
		// 在场景销毁时保存探索数据(可选，因映射中存的是引用，这里主要保证引用一致)
		Scene.on("destroy", scene => {
			if (scene && this.explored) {
				this.exploredByScene.set(scene.id, this.explored);
			}
		});
	}

	createCanvas(): void {
		if (!this.canvas) {
			this.canvas = document.createElement("canvas");
			this.canvas.width = this.width;
			this.canvas.height = this.height;
			this.ctx = this.canvas.getContext("2d")!;
			// 禁用平滑缩放，保持像素风格
			this.ctx.imageSmoothingEnabled = false;
			(this.ctx as any).webkitImageSmoothingEnabled = false;
			(this.ctx as any).msImageSmoothingEnabled = false;
			this.canvas.style.imageRendering = "pixelated";
			this.canvas.style.position = "absolute";
			this.canvas.style.zIndex = "1000";
			this.canvas.style.pointerEvents = "auto";
			// 设置canvas背景透明
			this.canvas.style.backgroundColor = "transparent";
			this._updateCanvasPosition();
			document.body.appendChild(this.canvas);
			this.canvas.addEventListener(
				"wheel",
				e => {
					e.preventDefault();
					e.stopPropagation(); // 阻止冒泡，避免影响主摄像机缩放
					if (e.deltaY < 0) {
						this.scale = Math.min(this.maxScale, this.scale * 1.1);
					} else {
						this.scale = Math.max(this.minScale, this.scale / 1.1);
					}
					this.render();
				},
				{ passive: false },
			);
		}
	}

	render(): void {
		if (!this.enabled || !Scene.binding) return;
		const scene = Scene.binding;
		const ctx = this.ctx;
		const isMobile = Stats.isMobile();
		// 清除画布并填充透明背景
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.fillStyle = "rgba(0, 0, 0, 0)";
		ctx.fillRect(0, 0, this.width, this.height);

		ctx.save();
		ctx.beginPath();
		if (this.shape === "circle") {
			const radius = Math.min(this.width, this.height) / 2;
			ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
		} else {
			ctx.rect(0, 0, this.width, this.height);
		}
		ctx.clip();

		// 以摄像机中心为缩放原点，保证玩家点在缩放后仍位于小地图中心
		const cameraCenterX = Camera.scrollCenterX / scene.tileWidth;
		const cameraCenterY = Camera.scrollCenterY / scene.tileHeight;
		let shiftX = (cameraCenterX * this.width) / scene.width;
		let shiftY = (cameraCenterY * this.height) / scene.height;

		// 视图限制：仅当视图面积小于场景面积时才进行裁剪，
		// 若场景尺寸不足以填满视图，允许出现边缘留白以保持跟随效果
		const viewWidth = this.width / this.scale;
		const viewHeight = this.height / this.scale;

		const halfViewW = viewWidth / 2;
		const halfViewH = viewHeight / 2;

		if (Party.player) {
			// 基于玩家位置调整视图中心，确保玩家始终可见
			let playerPx = (Party.player.x * this.width) / scene.width;
			let playerPy = (Party.player.y * this.height) / scene.height;

			// 移动端横屏时需要调整坐标映射
			if (isMobile) {
				const temp = playerPx;
				playerPx = this.width - playerPy;
				playerPy = temp;
			}

			shiftX = playerPx;
			shiftY = playerPy;
		}

		// clamp 以避免出现空白区域
		shiftX = Math.min(Math.max(shiftX, halfViewW), this.width - halfViewW);
		shiftY = Math.min(Math.max(shiftY, halfViewH), this.height - halfViewH);

		// 先将原点移动到小地图中心，再根据缩放系数放大/缩小，最后把世界坐标系移动到摄像机中心
		ctx.translate(this.width / 2, this.height / 2);
		ctx.scale(this.scale, this.scale);
		ctx.translate(-shiftX, -shiftY);

		if (!this.bgCanvas) this.bgDirty = true;

		if (this.bgDirty) {
			Callback.push(() => {
				this._rebuildBackground(scene);
			});
			this.bgDirty = false;
		}

		if (this.bgCanvas) {
			ctx.drawImage(this.bgCanvas, 0, 0);
		}

		// 绘制障碍物
		ctx.fillStyle = Color.parseCSSColor(this.obstacleColor);
		const obstacleSize = isMobile ? 1.4 * this.mobileIconScale : 2;
		for (let y = 0; y < scene.height; y++) {
			for (let x = 0; x < scene.width; x++) {
				if (scene.obstacle.get(x, y)) {
					let px = Math.floor((x * this.width) / scene.width);
					let py = Math.floor((y * this.height) / scene.height);

					// 移动端横屏时需要调整坐标映射
					if (isMobile) {
						const temp = px;
						px = this.width - py;
						py = temp;
					}

					ctx.fillRect(px, py, obstacleSize, obstacleSize);
				}
			}
		}

		// 绘制玩家
		const player = Party.player;
		if (player) {
			let px = Math.floor((player.x * this.width) / scene.width);
			let py = Math.floor((player.y * this.height) / scene.height);

			// 移动端横屏时需要调整坐标映射
			if (isMobile) {
				const temp = px;
				px = this.width - py;
				py = temp;
			}

			if (this.playerMode === "avatar" && player.portrait) {
				const img: HTMLImageElement | null = Loader.getImage
					? Loader.getImage({ guid: player.portrait })
					: null;
				const size = isMobile ? 3 * this.mobileIconScale : 4;
				if (img && img.complete) {
					const clip = player.clip || [0, 0, img.width, img.height];
					const [sx, sy, sw, sh] = clip;
					ctx.drawImage(
						img,
						sx,
						sy,
						sw,
						sh,
						px - (size >> 1),
						py - (size >> 1),
						size,
						size,
					);
				} else if (
					player.portrait &&
					Loader.loadImage &&
					!this._loadingImages.has(player.portrait)
				) {
					this._loadingImages.add(player.portrait);
					Loader.loadImage({ guid: player.portrait })
						.then(() => {
							this._loadingImages.delete(player.portrait);
						})
						.catch(() => this._loadingImages.delete(player.portrait));
				} else {
					ctx.fillStyle = Color.parseCSSColor(this.playerColor);
					const dotSize = isMobile ? 2 * this.mobileIconScale : 3;
					const offset = dotSize / 2;
					ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
				}
			} else {
				ctx.fillStyle = Color.parseCSSColor(this.playerColor);
				const dotSize = isMobile ? 2 * this.mobileIconScale : 3;
				const offset = dotSize / 2;
				ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
			}

			// === 迷雾探索更新逻辑 ===
			if (this.fogEnabled && this.fogCtx) {
				const playerTileX = Math.floor(player.x);
				const playerTileY = Math.floor(player.y);
				const fogRadius = this.fogRadius;
				const fogRadiusSq = fogRadius * fogRadius;

				const dw = Math.max(1, Math.ceil(this.width / scene.width));
				const dh = Math.max(1, Math.ceil(this.height / scene.height));

				// 遍历迷雾半径范围内的所有格子
				for (let dy = -fogRadius; dy <= fogRadius; dy++) {
					for (let dx = -fogRadius; dx <= fogRadius; dx++) {
						const tileX = playerTileX + dx;
						const tileY = playerTileY + dy;

						// 边界检查
						if (
							tileX < 0 ||
							tileX >= scene.width ||
							tileY < 0 ||
							tileY >= scene.height
						) {
							continue;
						}

						// 圆形半径判断 (性能优先使用平方比较)
						if (dx * dx + dy * dy > fogRadiusSq) {
							continue;
						}

						// 仅对未探索的格子进行处理
						if (!this.explored[tileY][tileX]) {
							this.explored[tileY][tileX] = true;

							// 增量清除迷雾，无需重绘整张图
							let fpx = Math.floor((tileX * this.width) / scene.width);
							let fpy = Math.floor((tileY * this.height) / scene.height);

							// 移动端横屏坐标转换
							if (isMobile) {
								const temp = fpx;
								fpx = this.width - fpy;
								fpy = temp;
							}

							this.fogCtx.clearRect(fpx, fpy, dw, dh);
						}
					}
				}
			}
		}

		// 绘制角色
		for (const actor of scene.actor.list) {
			if (actor === player) continue;
			const isEnemy = Team.isEnemy(actor.teamId, player ? player.teamId : "");
			const mode = isEnemy ? this.enemyMode : this.memberMode;
			const color = isEnemy ? this.enemyColor : this.memberColor;
			let px = Math.floor((actor.x * this.width) / scene.width);
			let py = Math.floor((actor.y * this.height) / scene.height);

			// 移动端横屏时需要调整坐标映射
			if (isMobile) {
				const temp = px;
				px = this.width - py;
				py = temp;
			}

			if (mode === "avatar" && actor.portrait) {
				const img: HTMLImageElement | null = Loader.getImage
					? Loader.getImage({ guid: actor.portrait })
					: null;
				const size = isMobile ? 3 * this.mobileIconScale : 4;
				if (img && img.complete) {
					const clip = actor.clip || [0, 0, img.width, img.height];
					const [sx, sy, sw, sh] = clip;
					ctx.drawImage(
						img,
						sx,
						sy,
						sw,
						sh,
						px - (size >> 1),
						py - (size >> 1),
						size,
						size,
					);
				} else if (
					!this._loadingImages.has(actor.portrait) &&
					Loader.loadImage
				) {
					this._loadingImages.add(actor.portrait);
					Loader.loadImage({ guid: actor.portrait })
						.then(() => this._loadingImages.delete(actor.portrait))
						.catch(() => this._loadingImages.delete(actor.portrait));
					ctx.fillStyle = Color.parseCSSColor(color);
					const dotSize = isMobile ? 2 * this.mobileIconScale : 3;
					const offset = dotSize / 2;
					ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
				} else {
					ctx.fillStyle = Color.parseCSSColor(color);
					const dotSize = isMobile ? 2 * this.mobileIconScale : 3;
					const offset = dotSize / 2;
					ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
				}
			} else {
				ctx.fillStyle = Color.parseCSSColor(color);
				const dotSize = isMobile ? 2 * this.mobileIconScale : 3;
				const offset = dotSize / 2;
				ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
			}
		}

		// 绘制触发器
		ctx.fillStyle = Color.parseCSSColor(this.triggerColor);
		for (const trigger of scene.trigger.list) {
			let px = Math.floor((trigger.x * this.width) / scene.width);
			let py = Math.floor((trigger.y * this.height) / scene.height);

			// 移动端横屏时需要调整坐标映射
			if (isMobile) {
				const temp = px;
				px = this.width - py;
				py = temp;
			}

			const dotSize = isMobile ? 2 * this.mobileIconScale : 3;
			const offset = dotSize / 2;
			ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
		}

		// 绘制未探索区域（迷雾）
		if (this.fogEnabled && this.fogCanvas) {
			ctx.drawImage(this.fogCanvas, 0, 0);
		}

		// 绘制边框
		if (this.borderWidth > 0) {
			ctx.save();
			ctx.strokeStyle = Color.parseCSSColor(this.borderColor);
			ctx.lineWidth = isMobile
				? this.borderWidth * this.mobileIconScale
				: this.borderWidth;
			if (this.shape === "circle") {
				if (this.scale === 1) {
					const radius =
						Math.min(this.width, this.height) / 2 - ctx.lineWidth / 2;
					ctx.beginPath();
					ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
					ctx.stroke();
				}
			} else {
				ctx.strokeRect(
					ctx.lineWidth / 2,
					ctx.lineWidth / 2,
					this.width - ctx.lineWidth,
					this.height - ctx.lineWidth,
				);
			}
			ctx.restore();
		}
		ctx.restore();
	}

	onDestroy(): void {
		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}
		this.enabled = false;
	}

	/**
	 * 隐藏小地图
	 */
	hide(): void {
		if (this.canvas) {
			this.canvas.style.display = "none";
		}
		this.enabled = false;
	}

	/**
	 * 显示小地图
	 */
	show(): void {
		if (!this.canvas) {
			this.createCanvas();
		}
		if (this.canvas) {
			this.canvas.style.display = "block";
		}
		this.enabled = true;
		this.render();
	}

	/** 重建背景缓存 */
	private _rebuildBackground(scene: SceneContext): void {
		if (!this.bgCanvas) {
			this.bgCanvas = document.createElement("canvas");
			this.bgCanvas.width = this.width;
			this.bgCanvas.height = this.height;
		}
		this.bgCtx = this.bgCanvas.getContext("2d")!;
		// 背景层同样关闭平滑
		this.bgCtx.imageSmoothingEnabled = false;
		const ctx = this.bgCtx;
		ctx.clearRect(0, 0, this.width, this.height);

		let drewAny = false;
		const isMobile = Stats.isMobile();

		if (scene.parallax && scene.parallax.tilemaps) {
			// 按 order 排序，保证绘制层级一致
			const sortedMaps = scene.parallax.tilemaps.reverse();
			let index = 0;
			for (const tilemap of sortedMaps) {
				if (!(tilemap as any).tiles) continue;
				if (!tilemap.visible) continue;
				const tiles = (tilemap as any).tiles;
				const width = (tilemap as any).width;
				const height = (tilemap as any).height;
				const tileData = (tilemap as any).tileData;
				const LoaderRef = Loader;
				const dw = Math.max(1, Math.ceil(this.width / scene.width));
				const dh = Math.max(1, Math.ceil(this.height / scene.height));

				for (let ty = 0; ty < height; ty++) {
					for (let tx = 0; tx < width; tx++) {
						const tileIdx = tx + ty * width;
						const tileId = tiles[tileIdx];
						if (!tileId) continue;
						const data = tileData[tileId & 0xffffff00];
						if (!data) continue;

						let guid: string | undefined;
						let sx = 0,
							sy = 0,
							sw = 0,
							sh = 0;

						if (data.type === "normal") {
							const tileset = data.tileset;
							guid = tileset.image;
							sw = tileset.tileWidth;
							sh = tileset.tileHeight;
							sx = sw * data.x;
							sy = sh * data.y;
						} else if (data.type === "auto") {
							const tileset = data.tileset;
							const autoTile = data.autoTile;
							const nodeId = tileId & 0b111111;
							const node = data.template?.nodes[nodeId];
							if (!node) continue;
							const frame = node.frames[0];
							const frameX = frame & 0xff;
							const frameY = frame >> 8;
							guid = autoTile.image;
							sw = tileset.tileWidth;
							sh = tileset.tileHeight;
							sx = (autoTile.x + frameX) * sw;
							sy = (autoTile.y + frameY) * sh;
						}

						const startX = (tilemap as any).tileStartX ?? tilemap.x;
						const startY = (tilemap as any).tileStartY ?? tilemap.y;
						let px = Math.floor(((startX + tx) * this.width) / scene.width);
						let py = Math.floor(((startY + ty) * this.height) / scene.height);

						// 移动端横屏时需要调整坐标映射
						if (isMobile) {
							const temp = px;
							px = this.width - py;
							py = temp;
						}

						let drawn = false;

						if (guid && LoaderRef) {
							const img: HTMLImageElement | null = LoaderRef.getImage
								? LoaderRef.getImage({ guid })
								: null;
							if (img && img.complete) {
								ctx.save();
								if (isMobile) {
									// 在移动端横屏时，需要旋转每个图块
									ctx.translate(px + dw / 2, py + dh / 2);
									ctx.rotate(Math.PI / 2);
									ctx.translate(-dw / 2, -dh / 2);
									ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dh, dw);
								} else {
									ctx.drawImage(img, sx, sy, sw, sh, px, py, dw, dh);
								}
								ctx.restore();
								drawn = true;
								drewAny = true;
							} else {
								// 若纹理未准备好则异步加载
								if (!this._loadingImages.has(guid) && LoaderRef.loadImage) {
									this._loadingImages.add(guid);
									LoaderRef.loadImage({ guid })
										.then(() => {
											this._loadingImages.delete(guid);
											this.bgDirty = true; // 纹理加载完后重新构建背景
										})
										.catch(() => {
											this._loadingImages.delete(guid);
										});
								}
							}
						}

						if (!drawn) {
							// 绘制默认颜色
							let color = "#cccccc";
							if (data.tileset && data.tileset.id) {
								if (this.layerColor[index]) {
									color = Color.parseCSSColor(this.layerColor[index]);
								} else {
									const hash = Array.from(String(data.tileset.id)).reduce(
										(a, c) => a + (typeof c === "string" ? c.charCodeAt(0) : 0),
										0,
									);
									color = `hsl(${hash % 360},60%,70%)`;
								}
							}
							ctx.fillStyle = color;
							if (isMobile) {
								ctx.save();
								ctx.translate(px + dw / 2, py + dh / 2);
								ctx.rotate(Math.PI / 2);
								ctx.translate(-dw / 2, -dh / 2);
								ctx.fillRect(0, 0, dh, dw);
								ctx.restore();
							} else {
								ctx.fillRect(px, py, dw, dh);
							}
							drewAny = true;
						}
					}
				}
				index++;
			}
		}
		if (!drewAny) {
			this.bgDirty = true;
		}
	}

	/**
	 * 根据当前 position / offsetX / offsetY / positionX / positionY 更新 Canvas 的 CSS 坐标
	 */
	private _updateCanvasPosition(): void {
		if (!this.canvas) return;
		this.canvas.style.top = "";
		this.canvas.style.bottom = "";
		this.canvas.style.left = "";
		this.canvas.style.right = "";

		const isMobile = Stats.isMobile();
		const position = (this.position || "right-top").toLowerCase();

		// 移动端横屏时调整位置
		if (isMobile) {
			switch (position) {
				case "right-top":
					this.canvas.style.bottom = `${16 + this.positionOffsetX}px`;
					this.canvas.style.right = `${16 + this.positionOffsetY}px`;
					break;
				case "right-bottom":
					this.canvas.style.top = `${16 + this.positionOffsetX}px`;
					this.canvas.style.right = `${16 + this.positionOffsetY}px`;
					break;
				case "left-top":
					this.canvas.style.bottom = `${16 + this.positionOffsetX}px`;
					this.canvas.style.left = `${16 + this.positionOffsetY}px`;
					break;
				case "left-bottom":
					this.canvas.style.top = `${16 + this.positionOffsetX}px`;
					this.canvas.style.left = `${16 + this.positionOffsetY}px`;
					break;
				case "custom-position":
					// 移动端横屏时，交换x和y坐标，并调整方向
					this.canvas.style.bottom = `${this.positionX}px`;
					this.canvas.style.right = `${this.positionY}px`;
					break;
				default:
					this.canvas.style.bottom = `${16 + this.positionOffsetX}px`;
					this.canvas.style.right = `${16 + this.positionOffsetY}px`;
			}
		} else {
			// PC端保持原有逻辑
			switch (position) {
				case "right-top":
					this.canvas.style.right = `${16 + this.positionOffsetX}px`;
					this.canvas.style.top = `${16 + this.positionOffsetY}px`;
					break;
				case "right-bottom":
					this.canvas.style.right = `${16 + this.positionOffsetX}px`;
					this.canvas.style.bottom = `${16 + this.positionOffsetY}px`;
					break;
				case "left-top":
					this.canvas.style.left = `${16 + this.positionOffsetX}px`;
					this.canvas.style.top = `${16 + this.positionOffsetY}px`;
					break;
				case "left-bottom":
					this.canvas.style.left = `${16 + this.positionOffsetX}px`;
					this.canvas.style.bottom = `${16 + this.positionOffsetY}px`;
					break;
				case "custom-position":
					this.canvas.style.left = `${this.positionX}px`;
					this.canvas.style.top = `${this.positionY}px`;
					break;
				default:
					this.canvas.style.right = `${16 + this.positionOffsetX}px`;
					this.canvas.style.top = `${16 + this.positionOffsetY}px`;
			}
		}
	}

	/**
	 * 设置小地图位置，调用后立即更新 canvas 样式
	 * @param position 预设位置("right-top" | "right-bottom" | "left-top" | "left-bottom" | "custom-position")
	 * @param options  可选参数：
	 *        offsetX / offsetY  —  预设位置模式下的偏移量
	 *        x / y             —  自定义坐标，仅在 custom-position 时有效
	 */
	public setPosition(
		position: string,
		options: {
			offsetX?: number;
			offsetY?: number;
			x?: number;
			y?: number;
		} = {},
	): void {
		this.position = position;
		this.positionOffsetX = options.offsetX ?? this.positionOffsetX;
		this.positionOffsetY = options.offsetY ?? this.positionOffsetY;
		if (position.toLowerCase() === "custom-position") {
			if (Stats.isMobile()) {
				// 移动端横屏时，交换x和y坐标
				this.positionX = options.y ?? this.positionX;
				this.positionY = options.x ?? this.positionY;
			} else {
				this.positionX = options.x ?? this.positionX;
				this.positionY = options.y ?? this.positionY;
			}
		}
		this._updateCanvasPosition();
	}

	/** 重新生成整张迷雾图 */
	private _rebuildFog(scene: SceneContext): void {
		if (!this.fogEnabled || !this.fogCtx) return;
		const ctx = this.fogCtx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, this.width, this.height);
		ctx.clip();

		ctx.fillStyle = Color.parseCSSColor(this.fogColor);
		ctx.fillRect(0, 0, this.width, this.height);
		const dw = Math.max(1, Math.ceil(this.width / scene.width));
		const dh = Math.max(1, Math.ceil(this.height / scene.height));

		for (let y = 0; y < scene.height; y++) {
			for (let x = 0; x < scene.width; x++) {
				if (this.explored[y][x]) {
					const px = Math.floor((x * this.width) / scene.width);
					const py = Math.floor((y * this.height) / scene.height);
					ctx.clearRect(px, py, dw, dh);
				}
			}
		}
		ctx.restore();
	}
}
