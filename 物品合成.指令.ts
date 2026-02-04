/*
 * @Author: xuranXYS
 * @LastEditTime: 2023-11-12 22:20:29
 * @GitHub: www.github.com/xiaoxustudio
 * @WebSite: www.xiaoxustudio.top
 * @Description: By xuranXYS
 */
/*
@plugin 物品合成
@version 1.0
@author 徐然
@link https://space.bilibili.com/291565199
@desc 
物品合成插件，包括物品添加，物品属性随机，合成类型，混合合成等操作

【添加物品合成指令】
物品列表：
支持类型：item（物品），item（装备）
使用方法：
类型 , id , 数量

判断操作：
当为全等，判断ID和数量是否一致
当为ID相等，只会判断ID是否一致
当为不处理，则可直接合成

模板物品：
根据这个物品模板创建最后合成的物品

继承类型（如何继承属性）：
并集属性：将物品列表全部存在的属性加入到合成物品的属性里
交集属性：将物品列表都互相存在的属性加入到合成物品的属性里
不处理：不进行处理，使用模板默认属性

映射属性列表组：
根据这个列表组映射表达式列表的公式

表达式列表：
根据上面的映射属性列表组中键值设置相应随机属性
表达式格式：
key:value
key可为中文值，也可为键值(自动检测)
value支持：
数组，如[123,456]，["测试","测试123"]
范围，如1~10、10~5（这个会自动转换为5~10）
值，如1、2

可混合合成：
开启后可混合合成（默认不可混合合成）

【查询指定id的合成表】
指定id或id组查询相应的合成表

【物品源数据转换】
将物品列表里面的源数据转换为真实物品对象

【合成物品】
合成回调：
1.@index：循环索引
2.@result：对应合成数据对象
3.@table：合成表对象
4.@merge：最后合成的物品（只有最后一次循环才生成）

@option op {"add_merge","find_merge","get_mergekey","convert_item","can_merge","reduce_merge","merge_item"}
@alias 操作 {添加物品合成,查询指定id的合成表,获取合成属性,物品源数据转换,是否可以合成,减少物品（根据合成表）,合成物品}

@actor-getter merge_actor
@alias 减少的角色
@desc 被减少的物品角色
@cond op {"reduce_merge"}

@variable-setter merge_obj_arr
@alias 合成数据
@desc 被合成的物品对象数据(数组)
@cond op {"can_merge","merge_item","reduce_merge"}

@file event_call
@filter event
@alias 合成回调
@cond op {"merge_item"}
@desc
合成回调：
1.@index：循环索引
2.@result：对应合成数据对象
3.@table：合成表对象
4.@merge：最后合成的物品（只有最后一次循环才生成）

@variable-setter item_obj
@alias 合成表对象
@desc 合成表对象数据
@cond op {"can_merge","merge_item","reduce_merge"}

@variable-setter item_ori
@alias 子项源数据
@desc 合成表物品列表数据
@cond op {"convert_item"}


@string merge_name
@alias 合成表名称
@cond op {"add_merge"}

@string[] item_list
@alias 物品列表
@cond op {"add_merge"}

@option add_list_op {"all_equal","id_equal","no_process"}
@alias 判断操作 {全等,ID相等,不处理}
@cond op {"add_merge"}
@desc 影响是否可以合成指令

@option add_out_op {"item","equip"}
@alias 合成类型 {物品,装备}
@cond op {"add_merge"}

@file model_item
@alias 模板物品
@cond op {"add_merge"}

@option inherit_type {"bj_attr","jj_attr","no_process"}
@alias 继承类型 {并集属性,交集属性,不处理}
@desc 影响输出合成出的物品属性数量
@cond op {"add_merge"}

@attribute-group attr_list
@alias 映射属性表组
@desc 根据映射对应属性
@cond op {"add_merge"}

@string[] put_list
@alias 表达式列表
@cond op {"add_merge"}
@desc 通过表达式确定合成出的物品属性
表达式格式：
key:value
key可为中文值，也可为键值(自动检测)
value支持：
数组，如[123,456]，["测试","测试123"]
范围，如1~10、10~5（这个会自动转换为5~10）
值，如1、2

@boolean is_mix
@alias 可混合合成
@default false
@cond op {"add_merge"}
@desc 开启后可使用不同类型合成

@string string_id
@alias 物品字符串ID
@cond op {"find_merge"}
@desc 传入物品字符串ID（数组或字符串）

@variable-setter merge_varobj
@alias 合成表对象
@desc 目标合成表对象
@cond op {"get_mergekey"}

@option mergekey_type {"merge_name","list_op","item_list","is_mix","out_op"}
@alias 获取 {合成表名称,合成操作,物品列表,是否混合,合成类型}
@cond op {"get_mergekey"}

@variable-setter save_var
@alias 保存到变量
@desc 操作保存到变量
@cond op {"find_merge","get_mergekey","convert_item","can_merge"}

*/
type AnyRecord = Record<string, any>;

class xr {
	static showInfo(): void {
		console.log(
			`   ____         __   __                      \n` +
				`  |  _ \\        \\ \\ / /                      \n` +
				`  | |_) |_   _   \\ V /_   _ _ __ __ _ _ __   \n` +
				`  |  _ <| | | |   > <| | | | '__/ _\` | '_ \\  \n` +
				`  | |_) | |_| |  / . \\ |_| | | | (_| | | | | \n` +
				`  |____/ \\__, | /_/ \\_\\__,_|_|  \\__,_|_| |_| \n` +
				`          __/ |                              \n` +
				`         |___/                               \n` +
				"\n\n  物品合成系统  \n\n" +
				"🏠b站：https://space.bilibili.com/291565199\n\n" +
				"📞github：https://github.com/xiaoxustudio\n\n" +
				"🌒官网：www.xiaoxustudio.top\n\n",
		);
	}
	static convertToJSON(object: any): string {
		let cache: any[] = [];

		let json = JSON.stringify(object, function (key: string, value: any) {
			if (typeof value === "object" && value !== null) {
				if (cache.includes(value)) {
					return "";
				}
				cache.push(value);
			}
			return value;
		});

		return json;
	}
	static get_global(str: string): any {
		const groups = Variable.groups as AnyRecord;
		for (let i in groups) {
			for (let k in groups[i]) {
				if (str == groups[i][k].name) {
					return groups[i][k].value;
				}
			}
		}
		return null;
	}

	static CompileData(
		obj: any,
		id: any = null,
		num: any = null,
		type: any = null,
		data: any = {},
	): string {
		return JSON.stringify({
			id: id ? id : 0,
			pack_num: num ? num : 0,
			type: type ? type : "chunk",
			value: obj,
			data:
				data.length != 0
					? data
					: { BufferSize: Math.ceil(obj.length * 1024 * 2) },
		});
	}
	static compile(r: any): void {
		let commands = [...CurrentEvent.commands];
		commands.unshift(Command.compile(r)[0]);
		let eh = new EventHandler(Command.compile(r));
		EventHandler.call(eh);
	}
	static compileVar(msg: string): any {
		// 将字符串里面的变量编译为文本
		let regex = /<(.*?):(.*?)>+/g;
		const matches: Array<{ type: string; content: string }> = [];
		let match: RegExpExecArray | null;
		const currentAttributes = CurrentEvent.attributes as AnyRecord;
		// 内置变量
		const mapTo: Record<string, string> = {
			actor: "triggerActor",
			cactor: "casterActor",
			skill: "triggerSkill",
			state: "triggerState",
			equip: "triggerEquipment",
			item: "triggerItem",
			object: "triggerObject",
			light: "triggerLight",
			region: "triggerRegion",
			elem: "triggerElement",
		};
		while ((match = regex.exec(msg)) !== null) {
			matches.push({ type: match[1], content: match[2] });
		}
		for (let i in matches) {
			for (let na in mapTo) {
				if (matches[i]["type"] == na) {
					return (currentAttributes[matches[i]["type"]] as AnyRecord)?.[
						"attributes"
					]?.[matches[i]["content"]];
				}
			}
			//其他类型
			if (matches[i]["type"] == "local") {
				for (let k in mapTo) {
					if (k == matches[i]["content"]) {
						matches[i]["content"] = mapTo[k];
					}
				}
				if (typeof currentAttributes[matches[i]["content"]] == "object") {
					return currentAttributes[matches[i]["content"]];
				}
				// 其他变量
				if (typeof currentAttributes[matches[i]["content"]] == "object") {
					let data = currentAttributes[matches[i]["content"]] as AnyRecord;
					let ms_l: AnyRecord = {};
					for (let obj_name in data) {
						if (typeof data[obj_name] != "object") {
							ms_l[obj_name] = data[obj_name];
						} else {
							ms_l[obj_name] = xr.convertToJSON(data[obj_name]);
						}
					}
					msg = String(msg).replace(
						"<" + matches[i]["type"] + ":" + matches[i]["content"] + ">",
						xr.convertToJSON(ms_l),
					);
				} else {
					msg = String(msg).replace(
						"<" + matches[i]["type"] + ":" + matches[i]["content"] + ">",
						currentAttributes[matches[i]["content"]],
					);
				}
			}
			if (matches[i]["type"] == "global") {
				if (typeof xr.get_global(matches[i]["content"]) == "object") {
					let data = xr.get_global(matches[i]["content"]);
					let ms_l: AnyRecord = {};
					for (let obj_name in data) {
						if (typeof data[obj_name] != "object") {
							ms_l[obj_name] = data[obj_name];
						} else {
							ms_l[obj_name] = xr.convertToJSON(data[obj_name]);
						}
					}
					msg = String(msg).replace(
						"<" + matches[i]["type"] + ":" + matches[i]["content"] + ">",
						xr.convertToJSON(ms_l),
					);
				} else {
					msg = String(msg).replace(
						"<" + matches[i]["type"] + ":" + matches[i]["content"] + ">",
						xr.get_global(matches[i]["content"]),
					);
				}
			}
		}
		return msg;
	}
}

/**
 * @description: 错误处理
 * @return {*}
 */
class Error_xr {
	constructor(msg: string, event: any, e: any) {
		const Map: Record<string, string> = {
			triggerActor: "name",
			casterActor: "name",
			triggerSkill: "name",
			triggerState: "name",
			triggerEquipment: "name",
			triggerItem: "name",
			triggerObject: "name",
			triggerLight: "name",
			triggerRegion: "name",
			triggerElement: "parent",
		};
		let str = "元素 Root";
		let _obj: AnyRecord | undefined;
		if (event.hasOwnProperty("triggerElement")) {
			try {
				_obj = event["triggerElement"] as AnyRecord;
				while (!(_obj["parent"] instanceof RootElement)) {
					str += "/" + (_obj["parent"] as AnyRecord).name;
					_obj = _obj["parent"] as AnyRecord;
				}
			} catch (e) {
				console.log((e as Error).message);
			}
		} else if (event.hasOwnProperty("triggerActor")) {
			let lex = "triggerActor";
			str = "角色 " + event[lex].attributes[Map[lex]];
		} else if (event.hasOwnProperty("triggerSkill")) {
			let lex = "triggerSkill";
			str = "技能 " + event[lex].attributes[Map[lex]];
		} else if (event.hasOwnProperty("triggerState")) {
			let lex = "triggerState";
			str = "状态 " + event[lex].attributes[Map[lex]];
		} else if (event.hasOwnProperty("triggerEquipment")) {
			let lex = "triggerEquipment";
			str = "装备 " + event[lex].attributes[Map[lex]];
		} else if (event.hasOwnProperty("triggerItem")) {
			let lex = "triggerItem";
			str = "物品 " + event[lex].attributes[Map[lex]];
		} else if (event.hasOwnProperty("triggerRegion")) {
			let lex = "triggerRegion";
			str = "区域 " + event[lex].attributes[Map[lex]];
		} else if (event.hasOwnProperty("triggerLight")) {
			let lex = "triggerLight";
			str = "光源 " + event[lex].attributes[Map[lex]];
		}
		console.log(msg, "\n", str, "\n", event);
		throw e;
	}
}
class Merge {
	merge_name!: string;
	item_list!: any[];
	is_mix!: boolean;
	list_op!: string;
	out_op!: string;
	put_list!: any[];
	inherit_type!: string;
	model!: any;
	attr_list!: any;
	constructor(data: AnyRecord) {
		for (let i in data) {
			(this as AnyRecord)[i] = data[i];
		}
	}
}
export default class Merge_System_xr {
	idMap: { [key: string]: number[] }; // 物品映射表
	_data: any[]; // 映射源表
	// 添加属性类型
	op!: string;
	merge_name!: string;
	add_list_op!: string;
	is_mix!: boolean;
	add_out_op!: string;
	item_list!: string[];
	inherit_type!: string;
	put_list!: string[];
	model_item!: any;
	attr_list!: any;
	string_id!: string;
	event_call!: any;
	merge_varobj!: any;
	mergekey_type!: string;
	save_var!: any;
	item_ori!: any;
	merge_obj_arr!: any;
	item_obj!: any;
	merge_actor!: any;
	constructor() {
		this._data = [];
		this.idMap = {};
		this.data = this._data;
	}
	get data(): any[] {
		return this._data;
	}
	set data(val: any[]) {
		this._data = val;
	}
	call() {
		switch (this.op) {
			case "add_merge": {
				try {
					this.add_merge({
						merge_name: xr.compileVar(this.merge_name),
						list_op: this.add_list_op,
						is_mix: this.is_mix,
						out_op: this.add_out_op,
						item_list: this.item_list,
						inherit_type: this.inherit_type,
						put_list: this.put_list,
						model: this.model_item,
						attr_list: this.attr_list,
					});
				} catch (e) {
					new Error_xr("添加任务出错", Event, e);
				}
				break;
			}
			case "find_merge": {
				console.log(
					this.find_merge(
						xr.compileVar(this.string_id) instanceof Array
							? xr.compileVar(this.string_id)
							: xr.compileVar(String(this.string_id).trim()),
					),
					this.save_var,
				);

				this.save_var?.set(
					this.find_merge(
						xr.compileVar(this.string_id) instanceof Array
							? xr.compileVar(this.string_id)
							: xr.compileVar(String(this.string_id).trim()),
					),
				);
				break;
			}
			case "get_mergekey": {
				this.save_var?.set(this.merge_varobj?.get()?.[this.mergekey_type]);
				break;
			}
			case "convert_item": {
				try {
					let data = this.item_ori?.get() as AnyRecord;
					const a_to_b = (ori: AnyRecord) => {
						switch (ori.type) {
							case "item": {
								const itemData = Data.items[ori.id];
								if (!itemData) {
									return undefined;
								}
								let it = new Item(itemData);
								it.quantity = ori.num;
								return it;
							}
							case "equip": {
								const equipmentData = Data.equipments[ori.id];
								if (!equipmentData) {
									return undefined;
								}
								return new Equipment(equipmentData);
							}
						}
					};
					this.save_var?.set(a_to_b(data));
				} catch (e) {
					new Error_xr("转换子项错误", Event, e);
				}
				break;
			}
			case "can_merge": {
				try {
					this.save_var?.set(
						this.can_merge(this.merge_obj_arr?.get(), this.item_obj?.get()),
					);
				} catch (e) {
					new Error_xr("转换子项错误", Event, e);
				}
				break;
			}
			case "reduce_merge": {
				try {
					this.reduce_merge(
						this.merge_obj_arr?.get(),
						this.item_obj?.get(),
						this.merge_actor,
					);
				} catch (e) {
					new Error_xr("减少合成物品错误", Event, e);
				}
				break;
			}
			case "merge_item": {
				try {
					let data = this.merge_obj_arr?.get() as AnyRecord[] | undefined;
					if (!data) {
						return;
					}
					const commands = (EventManager.guidMap as AnyRecord)[this.event_call];
					for (let i = 0; i < data.length; i++) {
						if (commands) {
							const event = new EventHandler(commands);
							const currentAttributes = CurrentEvent.attributes as AnyRecord;
							currentAttributes["@result"] = data[i];
							currentAttributes["@table"] = this.item_obj?.get();
							currentAttributes["@index"] = i;
							if (i == data.length - 1) {
								currentAttributes["@merge"] = this.merge_call(
									this.item_obj?.get(),
								);
							}
							EventHandler.call(event);
						}
					}
				} catch (e) {
					new Error_xr("合成物品错误", Event, e);
				}
				break;
			}
		}
	}
	/**
	 * @description: 对象是否相等
	 * @param {*} obj1
	 * @param {*} obj2
	 * @return {*}
	 */
	isEqual(obj1: any, obj2: any): boolean {
		// 检查对象类型
		if (typeof obj1 !== typeof obj2) {
			return false;
		}

		// 检查基本类型
		if (typeof obj1 !== "object" || obj1 === null || obj2 === null) {
			return obj1 === obj2;
		}

		// 检查数组
		if (Array.isArray(obj1) && Array.isArray(obj2)) {
			if (obj1.length !== obj2.length) {
				return false;
			}
			for (let i = 0; i < obj1.length; i++) {
				if (!this.isEqual(obj1[i], obj2[i])) {
					return false;
				}
			}
			return true;
		}

		// 检查对象
		const keys1 = Object.keys(obj1);
		const keys2 = Object.keys(obj2);
		if (keys1.length !== keys2.length) {
			return false;
		}
		for (const key of keys1) {
			if (!this.isEqual(obj1[key], obj2[key])) {
				return false;
			}
		}
		return true;
	}
	/**
	 * @description: 添加合并表
	 * @param {*} merge_name
	 * @param {*} left_list
	 * @param {*} right_list
	 * @param {*} is_mix
	 * @param {*} list_op
	 * @param {*} out_op
	 * @return {*}
	 */
	add_merge({
		merge_name = "",
		item_list = [],
		put_list = [],
		is_mix = false,
		inherit_type,
		list_op,
		out_op,
		model,
		attr_list,
	}: {
		merge_name?: string;
		item_list?: string[];
		put_list?: string[];
		is_mix?: boolean;
		inherit_type?: string;
		list_op?: string;
		out_op?: string;
		model?: any;
		attr_list?: any;
	}): boolean | void {
		// 解析任务物品
		let map_to = ["item", "skill", "equip"];
		const complie_put = (list: string[]) => {
			let all_list: AnyRecord[] = [];
			for (let key in list) {
				let item = list[key];
				let matches: RegExpMatchArray;
				try {
					matches = item.match(
						/\s*(.+)\s*:\s*\[\s*(.+)\s*\]\s*/,
					) as RegExpMatchArray;
					all_list.push({
						type: "array",
						key: xr.compileVar(matches[1].trim()),
						arr: JSON.parse(xr.compileVar("[" + matches[2] + "]").trim()),
					});
				} catch (e) {
					matches = item.match(/\s*(.+)\s*:\s*(.+)\s*/) as RegExpMatchArray;
					let sub_str = matches[2].trim();
					if (/\s*(.+)\s*~\s*(.+)\s*/.test(sub_str)) {
						let sub_match = sub_str.match(
							/\s*(.+)\s*~\s*(.+)\s*/,
						) as RegExpMatchArray;
						all_list.push({
							key: xr.compileVar(matches[1].trim()),
							left: Number(xr.compileVar(sub_match[1].trim())),
							right: Number(xr.compileVar(sub_match[2].trim())),
							type: "range",
						});
					} else {
						all_list.push({
							key: xr.compileVar(matches[1].trim()),
							val: xr.compileVar(
								/\s*((?=\()\(?)\s*(.+)\s*((?=\))\)?)\s*/.test(sub_str.trim())
									? new Function("return " + xr.compileVar(sub_str.trim()))()
									: xr.compileVar(sub_str.trim()),
							),
							type: "value",
						});
					}
				}
			}
			return all_list;
		};
		let putlist_compile = complie_put(put_list);
		const compile_list = (item: string[]) => {
			// 编译物品列表
			let first_type: string | undefined = undefined;
			let item_jx: AnyRecord[] = [];
			let reg_num = /^[0-9]+.?[0-9]*/;
			let item_ex: Record<string, { num: number }>;
			for (let i in item) {
				let str_splice = String(item[i]).trim().split(",");
				item_ex = {
					item: { num: parseFloat(String(str_splice[2]).trim()) },
					equip: { num: parseFloat(String(str_splice[2]).trim()) },
				};
				// 不是有效任务物品将不会被添加
				if (map_to.includes(String(str_splice[0]).trim())) {
					// 检测物品和装备任务是否有效
					if (
						String(str_splice[0]).trim() == "item" ||
						String(str_splice[0]).trim() == "equip"
					) {
						if (!first_type) {
							first_type = String(str_splice[0]).trim();
						}
						// 判断当前是否开启混合
						if (!is_mix && String(str_splice[0]).trim() != first_type) {
							return false;
						}
						if (!reg_num.test(String(str_splice[2]).trim())) {
							continue;
						}
					}
					item_jx.push({
						type: String(str_splice[0]).trim(),
						id: String(str_splice[1]).trim(),
						...item_ex[String(str_splice[0]).trim()],
					});
				}
			}
			return item_jx;
		};
		let data: ItemFile | EquipmentFile | undefined = undefined;
		switch (out_op) {
			case "item": {
				data = Data.items[model];
				break;
			}
			case "equip": {
				data = Data.equipments[model];
				break;
			}
		}
		if (!data) {
			// 不进行添加
			return false;
		}
		attr_list = Attribute.getGroup(attr_list);
		// 编译输出
		let itemlist_compile = compile_list(item_list);
		if (!itemlist_compile) {
			// 不进行添加
			return false;
		}
		let all_task = new Merge({
			merge_name,
			item_list: itemlist_compile,
			is_mix,
			list_op,
			out_op,
			put_list: putlist_compile,
			inherit_type,
			model: data,
			attr_list,
		});
		const compile_Map = (list: AnyRecord[]) => {
			// 添加任务
			let is_find = this.data.findIndex(table => this.isEqual(table, all_task));
			if (is_find === -1) {
				this.data.push(all_task);
			}
			let index = this.data.findIndex(table => this.isEqual(table, all_task));
			// 添加映射
			for (let key in list) {
				let item_ori = list[key];
				// 新物品
				if (!this.idMap.hasOwnProperty(item_ori.id)) {
					this.idMap[item_ori.id] = [index];
				} else {
					// 旧物品
					if (this.idMap[item_ori.id].findIndex(ind => ind == index) === -1) {
						this.idMap[item_ori.id].push(index);
					}
				}
			}
		};
		compile_Map(itemlist_compile);
	}
	/**
	 * @description: 按照物品ID查询合成表
	 * @param {*} id
	 * @return {*}
	 */
	find_merge(id: string | string[]): any[] {
		let res: any[] = [];
		if (id instanceof Array) {
			// 查找多组，并排除重复
			let arr = [...new Set(id)];
			for (let key in arr) {
				if (this.idMap.hasOwnProperty(arr[key])) {
					for (let i in this.idMap[arr[key]]) {
						let item = this.idMap[arr[key]][i];
						res.push(this.data[item]);
					}
				}
			}
			return [...new Set(res)];
		}
		if (this.idMap.hasOwnProperty(id)) {
			for (let i in this.idMap[id]) {
				let item = this.idMap[id][i];
				res.push(this.data[item]);
			}
		}
		return res;
	}
	/**
	 * @description: 判断是否可以合成
	 * @param {*} merge_arr
	 * @param {*} table
	 * @return {*}
	 */
	can_merge(merge_arr: any[], table: Merge): boolean {
		if (!(merge_arr instanceof Array)) {
			return false;
		}
		const acp = {
			merge_arr,
			get: (id: string) => {
				return merge_arr.filter((val: AnyRecord) =>
					val.id === id ? val : undefined,
				)?.[0];
			},
			count(id: string) {
				const list = merge_arr.filter((val: AnyRecord) =>
					val.id === id ? val : undefined,
				);
				if (!list) return 0;
				let count = 0;
				for (const goods of list) {
					count += goods.quantity ?? 1;
				}
				return count;
			},
		};
		if (table instanceof Merge) {
			let map: AnyRecord = {};
			let compare_list = Array(table.item_list.length).fill(true);
			let compare_list_sub: boolean[] = [];
			for (let key in table.item_list) {
				let sub_item = table.item_list[key] as AnyRecord;
				let obj = acp.get(sub_item.id);
				if (table.list_op == "no_process") {
					compare_list_sub.push(true);
					map[sub_item.id] = true;
					continue;
				}
				// 更新
				if (!map.hasOwnProperty(sub_item.id)) {
					// 判断操作
					if (
						table.list_op == "id_equal" &&
						(obj instanceof Equipment || obj instanceof Item)
					) {
						compare_list_sub.push(true);
						map[sub_item.id] = true;
						continue;
					}
					// 装备
					if (obj instanceof Equipment) {
						compare_list_sub.push(true);
						map[sub_item.id] = acp.count(sub_item.id) - 1;
					} else if (obj instanceof Item) {
						let num = acp.count(sub_item.id);
						// 物品
						if (num && num >= sub_item.num) {
							num -= sub_item.num;
							compare_list_sub.push(true);
						} else {
							compare_list_sub.push(false);
						}
						// 映射
						map[sub_item.id] = num;
					}
				} else {
					let num = Number(map[sub_item.id] ?? 0);
					// 判断操作
					if (
						table.list_op == "id_equal" &&
						(obj instanceof Equipment || obj instanceof Item)
					) {
						compare_list_sub.push(true);
						map[sub_item.id] = true;
						continue;
					}
					if (num && num >= sub_item.num) {
						num -= sub_item.num;
						compare_list_sub.push(true);
					} else {
						compare_list_sub.push(false);
					}
					// 映射
					map[sub_item.id] = num;
				}
			}
			if (
				compare_list.length === compare_list_sub.length &&
				compare_list.every((v, i) => v === compare_list_sub[i])
			) {
				return true;
			} else {
				return false;
			}
		}
		return false;
	}
	reduce_merge(merge_arr: AnyRecord[], table: Merge, merge_actor: AnyRecord) {
		let aci = merge_actor?.inventory;
		if (!(merge_arr instanceof Array)) {
			return false;
		}
		const acp = {
			merge_arr,
			get: (id: string) => {
				return merge_arr.filter((val: AnyRecord) =>
					val.id === id ? val : undefined,
				)?.[0];
			},
			count(id: string) {
				const list = merge_arr.filter((val: AnyRecord) =>
					val.id === id ? val : undefined,
				);
				if (!list) return 0;
				let count = 0;
				for (const goods of list) {
					count += goods.quantity ?? 1;
				}
				return count;
			},
		};
		if (table instanceof Merge) {
			let map: AnyRecord = {};
			let compare_list_sub: boolean[] = [];
			for (let key in table.item_list) {
				let sub_item = table.item_list[key] as AnyRecord;
				let obj = acp.get(sub_item.id);
				if (table.list_op == "no_process") {
					if (obj instanceof Equipment) {
						aci.deleteEquipment(sub_item.id);
					}
					if (obj instanceof Item) {
						aci.decreaseItems(sub_item.id, sub_item.num);
					}
					map[sub_item.id] = true;
					continue;
				}
				// 更新
				if (!map.hasOwnProperty(sub_item.id)) {
					// 判断操作
					if (
						table.list_op == "id_equal" &&
						(obj instanceof Equipment || obj instanceof Item)
					) {
						if (obj instanceof Equipment) {
							aci.deleteEquipment(sub_item.id);
						}
						if (obj instanceof Item) {
							aci.decreaseItems(sub_item.id, sub_item.num);
						}
						map[sub_item.id] = true;
						continue;
					}
					// 装备
					if (obj instanceof Equipment) {
						aci.deleteEquipment(sub_item.id);
						map[sub_item.id] = acp.count(sub_item.id) - 1;
					} else if (obj instanceof Item) {
						let num = acp.count(sub_item.id);
						// 物品
						if (num && num >= sub_item.num) {
							num -= sub_item.num;
							aci.decreaseItems(sub_item.id, sub_item.num);
						} else {
							compare_list_sub.push(false);
						}
						// 映射
						map[sub_item.id] = num;
					}
				} else {
					let num = Number(map[sub_item.id] ?? 0);
					// 判断操作
					if (
						table.list_op == "id_equal" &&
						(obj instanceof Equipment || obj instanceof Item)
					) {
						if (obj instanceof Equipment) {
							aci.deleteEquipment(sub_item.id);
						}
						if (obj instanceof Item) {
							aci.decreaseItems(sub_item.id, sub_item.num);
						}
						map[sub_item.id] = true;
						continue;
					}
					if (num && num >= sub_item.num) {
						num -= sub_item.num;
						aci.decreaseItems(sub_item.id, sub_item.num);
					} else {
						compare_list_sub.push(false);
					}
					// 映射
					map[sub_item.id] = num;
				}
			}
			if (compare_list_sub.length === 0) {
				return true;
			} else {
				return false;
			}
		}
	}
	/**
	 * @description: 物品合成
	 * @param {*} merge_table
	 * @return {*}
	 */
	merge_call(merge_table: Merge) {
		if (merge_table) {
			let data: Item | Equipment | undefined = undefined;
			switch (merge_table.out_op) {
				case "item": {
					data = new Item(merge_table.model);
					data.quantity = 1;
					break;
				}
				case "equip": {
					data = new Equipment(merge_table.model);
					break;
				}
			}
			if (!data) {
				return undefined;
			}
			// 属性继承处理
			let attr_all: {
				attr: AnyRecord;
				_cache: Record<string, number>;
				_cache_val: AnyRecord;
			} = {
				attr: {},
				_cache: {},
				_cache_val: {},
			};
			for (let i in merge_table.item_list) {
				let node = merge_table.item_list[i] as AnyRecord;
				let s_data: Item | Equipment | undefined = undefined;
				switch (node.type) {
					case "item": {
						const itemData = Data.items[node.id];
						if (!itemData) {
							continue;
						}
						s_data = new Item(itemData);
						s_data.quantity = node.num;
						break;
					}
					case "equip": {
						const equipmentData = Data.equipments[node.id];
						if (!equipmentData) {
							continue;
						}
						s_data = new Equipment(equipmentData);
						break;
					}
				}
				if (!s_data) {
					continue;
				}
				// 解析全部
				for (let ik in s_data.attributes) {
					if (attr_all._cache.hasOwnProperty(ik)) {
						attr_all._cache[ik] += 1;
					} else {
						attr_all._cache[ik] = 1;
					}
					attr_all._cache_val[ik] = s_data.attributes[ik];
				}
				// 判断继承处理
				switch (merge_table.inherit_type) {
					case "bj_attr": {
						for (let ik in attr_all._cache) {
							attr_all.attr[ik] = attr_all._cache_val[ik];
						}
						break;
					}
					case "jj_attr": {
						for (let ik in attr_all._cache) {
							if (attr_all._cache[ik] == merge_table.item_list.length) {
								attr_all.attr[ik] = attr_all._cache_val[ik];
							}
						}
						break;
					}
					case "no_process": {
						break;
					}
				}
			}
			// 属性修改
			const find = (id: string) => {
				const list = merge_table["attr_list"] as AnyRecord;
				for (let ik in list) {
					let a = list[ik];
					if (ik === id || a === id) {
						return ik;
					}
				}
				return undefined;
			};
			data.attributes = attr_all.attr;
			for (let i in merge_table.put_list) {
				let node = merge_table.put_list[i] as AnyRecord;
				let key = find(String(node.key));
				if (!key) {
					return undefined;
				}
				switch (node.type) {
					case "array": {
						data.attributes[key] =
							node.arr[Math.floor(Math.random() * node.arr.length)];
						break;
					}
					case "range": {
						if (node.right - node.left < 0) {
							data.attributes[key] =
								Math.floor(Math.random() * (node.left - node.right)) +
								node.right;
						} else {
							data.attributes[key] =
								Math.floor(Math.random() * (node.right - node.left)) +
								node.left;
						}
						break;
					}
					case "value": {
						data.attributes[key] = node.val;
						break;
					}
				}
			}
			return data;
		}
		return undefined;
	}
}
