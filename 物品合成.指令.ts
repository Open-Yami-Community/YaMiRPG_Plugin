/*
@plugin 物品合成
@version 1.10
@author 徐然
@link https://space.bilibili.com/291565199
@desc 
物品合成插件：新增合成表、校验合成、扣除材料、生成结果物品

【添加物品合成】
物品列表格式：类型,id,数量
类型仅支持 item（物品）与 equip（装备）

判断操作：
全等：同时判断ID与数量
ID相等：只判断ID
不处理：忽略校验，直接判定可合成

模板物品：
用于生成合成结果的基础物品

继承类型：
并集属性：取所有材料的全部属性
交集属性：仅取所有材料共同拥有的属性
不处理：不继承，使用模板默认属性

映射属性表组：
用于把表达式里的键映射到真实属性键

表达式列表：
格式 key:value
key 可为属性中文名或属性键
value 支持：
数组：["测试",123]
范围：1~10（自动整理为小到大）
数值或文本：1 或 abc

可混合合成：
开启后可混合使用物品与装备

【查询指定ID的合成表】
按物品ID或ID数组查询可合成表

【物品源数据转换】
把物品源数据转换为 Item/Equipment 实例

【合成物品】
合成回调参数：
* @index 循环索引
* @result 当前合成数据
* @table 合成表对象
* @merge 最终合成结果（仅最后一次回调存在）

@option op {"add_merge","find_merge","get_mergekey","convert_item","can_merge","reduce_merge","merge_item"}
@alias 操作 {添加物品合成,查询指定id的合成表,获取合成属性,物品源数据转换,是否可以合成,减少物品（根据合成表）,合成物品}

@actor-getter merge_actor
@alias 减少的角色
@desc 需要扣除材料的角色
@cond op {"reduce_merge"}

@variable-setter merge_obj_arr
@alias 合成数据
@desc 待合成的物品对象数组
@cond op {"can_merge","merge_item","reduce_merge"}

@file event_call
@filter event
@alias 合成回调
@cond op {"merge_item"}
@desc
合成回调参数：
* @index 循环索引
* @result 当前合成数据
* @table 合成表对象
* @merge 最终合成结果（仅最后一次回调存在）

@variable-setter item_obj
@alias 合成表对象
@desc 合成表对象数据
@cond op {"can_merge","merge_item","reduce_merge"}

@variable-setter item_ori
@alias 子项源数据
@desc 合成表中的单个物品源数据
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
@desc 影响合成校验规则

@option add_out_op {"item","equip"}
@alias 合成类型 {物品,装备}
@cond op {"add_merge"}

@file model_item
@alias 模板物品
@cond op {"add_merge"}

@option inherit_type {"bj_attr","jj_attr","no_process"}
@alias 继承类型 {并集属性,交集属性,不处理}
@desc 影响合成结果的属性继承方式
@cond op {"add_merge"}

@attribute-group attr_list
@alias 映射属性表组
@desc 属性映射表组
@cond op {"add_merge"}

@string[] put_list
@alias 表达式列表
@cond op {"add_merge"}
@desc 通过表达式设置合成结果的随机属性
格式 key:value，key 可为中文或键
value 支持数组、范围与单值

@boolean is_mix
@alias 可混合合成
@default false
@cond op {"add_merge"}
@desc 允许物品与装备混合合成

@string string_id
@alias 物品字符串ID
@cond op {"find_merge"}
@desc 物品ID或ID数组

@variable-setter merge_varobj
@alias 合成表对象
@desc 目标合成表对象
@cond op {"get_mergekey"}

@option mergekey_type {"merge_name","list_op","item_list","is_mix","out_op"}
@alias 获取 {合成表名称,合成操作,物品列表,是否混合,合成类型}
@cond op {"get_mergekey"}

@variable-setter save_var
@alias 保存到变量
@desc 操作结果保存到变量
@cond op {"find_merge","get_mergekey","convert_item","can_merge"}

*/
type AnyRecord = Record<string, any>;

const builtInMap: Record<string, string> = {
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

const safeStringify = (value: any) => {
	const cache = new Set<any>();
	return JSON.stringify(value, (_key, val) => {
		if (typeof val === "object" && val !== null) {
			if (cache.has(val)) {
				return "";
			}
			cache.add(val);
		}
		return val;
	});
};

const getGlobalValue = (name: string) => {
	const variableAny = Variable as AnyRecord;
	if (typeof variableAny.get === "function") {
		return variableAny.get(name);
	}
	const groups = variableAny.groups as AnyRecord;
	if (!groups) {
		return null;
	}
	for (let i in groups) {
		for (let k in groups[i]) {
			if (name === groups[i][k].name) {
				return groups[i][k].value;
			}
		}
	}
	return null;
};

const resolvePlaceholder = (
	type: string,
	content: string,
	attributes: AnyRecord,
) => {
	if (builtInMap[type]) {
		const target = attributes[builtInMap[type]] as AnyRecord;
		return target?.attributes?.[content];
	}
	if (type === "local") {
		const mapped = builtInMap[content] ?? content;
		return attributes[mapped];
	}
	if (type === "global") {
		return getGlobalValue(content);
	}
	return undefined;
};

const compileVar = (input: any) => {
	if (input === null || input === undefined) {
		return input;
	}
	if (typeof input !== "string") {
		return input;
	}
	const text = String(input);
	const regex = /<([^:>]+):([^>]+)>/g;
	const matches: Array<{ type: string; content: string; raw: string }> = [];
	let match: RegExpExecArray | null;
	while ((match = regex.exec(text)) !== null) {
		if (
			Object.keys(builtInMap).includes(match[1]) ||
			match[1] === "local" ||
			match[1] === "global"
		) {
			matches.push({ type: match[1], content: match[2], raw: match[0] });
		}
	}
	if (matches.length === 0) {
		return text;
	}
	const attrs = CurrentEvent.attributes as AnyRecord;
	if (matches.length === 1 && matches[0].raw === text) {
		const resolved = resolvePlaceholder(
			matches[0].type,
			matches[0].content,
			attrs,
		);
		return resolved === undefined ? text : resolved;
	}
	let result = text;
	for (const item of matches) {
		const resolved = resolvePlaceholder(item.type, item.content, attrs);
		if (resolved === undefined) {
			result = result.replace(item.raw, "");
			continue;
		}
		if (typeof resolved === "object") {
			result = result.replace(item.raw, safeStringify(resolved));
		} else {
			result = result.replace(item.raw, String(resolved));
		}
	}
	return result;
};

const getEventLabel = (event: AnyRecord) => {
	const map: Record<string, string> = {
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
	if (event.hasOwnProperty("triggerElement")) {
		let str = "元素 Root";
		let obj = event["triggerElement"] as AnyRecord;
		while (obj && !(obj["parent"] instanceof RootElement)) {
			str += "/" + (obj["parent"] as AnyRecord).name;
			obj = obj["parent"] as AnyRecord;
		}
		return str;
	}
	if (event.hasOwnProperty("triggerActor")) {
		return "角色 " + event["triggerActor"].attributes[map["triggerActor"]];
	}
	if (event.hasOwnProperty("triggerSkill")) {
		return "技能 " + event["triggerSkill"].attributes[map["triggerSkill"]];
	}
	if (event.hasOwnProperty("triggerState")) {
		return "状态 " + event["triggerState"].attributes[map["triggerState"]];
	}
	if (event.hasOwnProperty("triggerEquipment")) {
		return (
			"装备 " + event["triggerEquipment"].attributes[map["triggerEquipment"]]
		);
	}
	if (event.hasOwnProperty("triggerItem")) {
		return "物品 " + event["triggerItem"].attributes[map["triggerItem"]];
	}
	if (event.hasOwnProperty("triggerRegion")) {
		return "区域 " + event["triggerRegion"].attributes[map["triggerRegion"]];
	}
	if (event.hasOwnProperty("triggerLight")) {
		return "光源 " + event["triggerLight"].attributes[map["triggerLight"]];
	}
	return "事件";
};

class PluginError {
	constructor(msg: string, event: AnyRecord, error: any) {
		const label = getEventLabel(event);
		console.log(msg, "\n", label, "\n", event);
		throw error;
	}
}

type MergeItem = {
	type: "item" | "equip";
	id: string;
	num: number;
};

type PutNode =
	| { type: "array"; key: string; arr: any[] }
	| { type: "range"; key: string; left: number; right: number }
	| { type: "value"; key: string; val: any };

class MergeTable {
	merge_name!: string;
	item_list!: MergeItem[];
	is_mix!: boolean;
	list_op!: string;
	out_op!: string;
	put_list!: PutNode[];
	inherit_type!: string;
	model!: any;
	attr_list!: AnyRecord;
	constructor(data: AnyRecord) {
		Object.assign(this, data);
	}
}

const deepEqual = (a: any, b: any): boolean => {
	if (a === b) {
		return true;
	}
	if (typeof a !== typeof b) {
		return false;
	}
	if (typeof a !== "object" || a === null || b === null) {
		return a === b;
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			return false;
		}
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) {
				return false;
			}
		}
		return true;
	}
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) {
		return false;
	}
	for (const key of keysA) {
		if (!deepEqual(a[key], b[key])) {
			return false;
		}
	}
	return true;
};

const parseItemList = (items: string[], allowMix: boolean) => {
	const result: MergeItem[] = [];
	let firstType: "item" | "equip" | undefined;
	for (const raw of items) {
		const text = String(compileVar(raw)).trim();
		const parts = text.split(",");
		const type = String(parts[0] ?? "").trim();
		const id = String(compileVar(String(parts[1] ?? "").trim())).trim();
		const numRaw = String(parts[2] ?? "1").trim();
		const numValue = Number(compileVar(numRaw));
		if (type !== "item" && type !== "equip") {
			continue;
		}
		if (!firstType) {
			firstType = type;
		}
		if (!allowMix && type !== firstType) {
			return null;
		}
		if (!id || !Number.isFinite(numValue)) {
			continue;
		}
		result.push({ type, id, num: numValue > 0 ? numValue : 1 });
	}
	return result;
};

const parsePutList = (list: string[]) => {
	const result: PutNode[] = [];
	for (const raw of list) {
		const arrayMatch = String(raw).match(/\s*(.+?)\s*:\s*\[\s*(.+)\s*\]\s*/);
		if (arrayMatch) {
			const key = String(compileVar(arrayMatch[1].trim()));
			const content = String(compileVar(arrayMatch[2].trim()));
			try {
				const arr = JSON.parse("[" + content + "]");
				if (Array.isArray(arr)) {
					result.push({ type: "array", key, arr });
					continue;
				}
			} catch (e) {}
		}
		const match = String(raw).match(/\s*(.+?)\s*:\s*(.+)\s*/);
		if (!match) {
			continue;
		}
		const key = String(compileVar(match[1].trim()));
		const valueRaw = compileVar(match[2].trim());
		if (Array.isArray(valueRaw)) {
			result.push({ type: "array", key, arr: valueRaw });
			continue;
		}
		const valueStr = String(valueRaw).trim();
		if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
			try {
				const parsed = JSON.parse(valueStr);
				if (Array.isArray(parsed)) {
					result.push({ type: "array", key, arr: parsed });
					continue;
				}
			} catch (e) {}
		}
		if (valueStr.includes("~")) {
			const parts = valueStr.split("~").map(v => Number(compileVar(v.trim())));
			if (parts.length === 2 && parts.every(v => Number.isFinite(v))) {
				result.push({
					type: "range",
					key,
					left: parts[0],
					right: parts[1],
				});
				continue;
			}
		}
		if (typeof valueRaw !== "string") {
			result.push({ type: "value", key, val: valueRaw });
			continue;
		}
		if (/^\s*\(.+\)\s*$/.test(valueStr)) {
			try {
				const val = new Function("return " + valueStr)();
				result.push({ type: "value", key, val });
				continue;
			} catch (e) {}
		}
		const num = Number(valueStr);
		if (Number.isFinite(num) && valueStr !== "") {
			result.push({ type: "value", key, val: num });
			continue;
		}
		try {
			const parsed = JSON.parse(valueStr);
			result.push({ type: "value", key, val: parsed });
			continue;
		} catch (e) {}
		result.push({ type: "value", key, val: valueStr });
	}
	return result;
};

const resolveAttributeKey = (attrList: AnyRecord, key: string) => {
	if (!attrList) {
		return undefined;
	}
	if (Object.prototype.hasOwnProperty.call(attrList, key)) {
		return key;
	}
	for (const attrKey in attrList) {
		if (attrList[attrKey] === key) {
			return attrKey;
		}
	}
	return undefined;
};

const getById = (list: AnyRecord[], id: string) =>
	list.filter(val => (val?.id ?? "") === id)?.[0];

const countById = (list: AnyRecord[], id: string) => {
	const matched = list.filter(val => (val?.id ?? "") === id);
	let total = 0;
	for (const entry of matched) {
		const quantity = entry?.quantity ?? entry?.num ?? 1;
		const num = Number(quantity);
		total += Number.isFinite(num) ? num : 0;
	}
	return total;
};

export default class Merge_System_xr {
	idMap: { [key: string]: number[] };
	_data: MergeTable[];
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
	}
	get data(): MergeTable[] {
		return this._data;
	}
	set data(val: MergeTable[]) {
		this._data = val;
	}
	call() {
		switch (this.op) {
			case "add_merge": {
				try {
					this.addMerge({
						merge_name: compileVar(this.merge_name),
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
					new PluginError("添加任务出错", Event, e);
				}
				break;
			}
			case "find_merge": {
				const idValue = compileVar(this.string_id);
				const payload =
					idValue instanceof Array
						? idValue
						: compileVar(String(this.string_id).trim());
				this.save_var?.set(this.findMerge(payload));
				break;
			}
			case "get_mergekey": {
				this.save_var?.set(this.merge_varobj?.get()?.[this.mergekey_type]);
				break;
			}
			case "convert_item": {
				try {
					const data = this.item_ori?.get() as AnyRecord;
					this.save_var?.set(this.convertItem(data));
				} catch (e) {
					new PluginError("转换子项错误", Event, e);
				}
				break;
			}
			case "can_merge": {
				try {
					this.save_var?.set(
						this.canMerge(this.merge_obj_arr?.get(), this.item_obj?.get()),
					);
				} catch (e) {
					new PluginError("判断合成错误", Event, e);
				}
				break;
			}
			case "reduce_merge": {
				try {
					this.reduceMerge(
						this.merge_obj_arr?.get(),
						this.item_obj?.get(),
						this.merge_actor,
					);
				} catch (e) {
					new PluginError("减少合成物品错误", Event, e);
				}
				break;
			}
			case "merge_item": {
				try {
					const data = this.merge_obj_arr?.get() as AnyRecord[] | undefined;
					if (!data || !Array.isArray(data)) {
						return;
					}
					const commands = (EventManager.guidMap as AnyRecord)[this.event_call];
					for (let i = 0; i < data.length; i++) {
						if (commands) {
							const current = new EventHandler(commands);
							const currentAttributes = current.attributes as AnyRecord;
							currentAttributes["@result"] = data[i];
							currentAttributes["@table"] = this.item_obj?.get();
							currentAttributes["@index"] = i;
							if (i === data.length - 1) {
								currentAttributes["@merge"] = this.mergeCall(
									this.item_obj?.get(),
								);
							}
							EventHandler.call(current);
						}
					}
				} catch (e) {
					new PluginError("合成物品错误", Event, e);
				}
				break;
			}
		}
	}
	addMerge({
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
		let data: ItemFile | EquipmentFile | undefined = undefined;
		if (out_op === "item") {
			data = Data.items[model];
		} else if (out_op === "equip") {
			data = Data.equipments[model];
		}
		if (!data) {
			return false;
		}
		const attrGroup = Attribute.getGroup(attr_list);
		const compiledItems = parseItemList(item_list, is_mix);
		if (!compiledItems || compiledItems.length === 0) {
			return false;
		}
		const compiledPut = parsePutList(put_list);
		const table = new MergeTable({
			merge_name,
			item_list: compiledItems,
			is_mix,
			list_op,
			out_op,
			put_list: compiledPut,
			inherit_type,
			model: data,
			attr_list: attrGroup,
		});
		let index = this.data.findIndex(item => deepEqual(item, table));
		if (index === -1) {
			this.data.push(table);
			index = this.data.length - 1;
		}
		for (const item of compiledItems) {
			const id = item.id;
			if (!this.idMap[id]) {
				this.idMap[id] = [index];
			} else if (!this.idMap[id].includes(index)) {
				this.idMap[id].push(index);
			}
		}
	}
	findMerge(id: string | string[]) {
		const result: MergeTable[] = [];
		if (Array.isArray(id)) {
			const unique = Array.from(new Set(id));
			for (const key of unique) {
				const indices = this.idMap[key];
				if (!indices) {
					continue;
				}
				for (const idx of indices) {
					result.push(this.data[idx]);
				}
			}
			return Array.from(new Set(result));
		}
		const indices = this.idMap[id];
		if (indices) {
			for (const idx of indices) {
				result.push(this.data[idx]);
			}
		}
		return result;
	}
	canMerge(mergeArr: AnyRecord[], table: MergeTable) {
		if (!Array.isArray(mergeArr) || !(table instanceof MergeTable)) {
			return false;
		}
		if (table.list_op === "no_process") {
			return true;
		}
		const map: AnyRecord = {};
		for (const subItem of table.item_list) {
			const obj = getById(mergeArr, subItem.id);
			if (table.list_op === "no_process") {
				continue;
			}
			if (!map.hasOwnProperty(subItem.id)) {
				if (
					table.list_op === "id_equal" &&
					(obj instanceof Equipment || obj instanceof Item)
				) {
					map[subItem.id] = true;
					continue;
				}
				if (obj instanceof Equipment) {
					map[subItem.id] = countById(mergeArr, subItem.id) - 1;
					continue;
				}
				if (obj instanceof Item) {
					let num = countById(mergeArr, subItem.id);
					if (num >= subItem.num) {
						num -= subItem.num;
					} else {
						return false;
					}
					map[subItem.id] = num;
					continue;
				}
				return false;
			} else {
				if (
					table.list_op === "id_equal" &&
					(obj instanceof Equipment || obj instanceof Item)
				) {
					map[subItem.id] = true;
					continue;
				}
				let num = Number(map[subItem.id] ?? 0);
				if (num >= subItem.num) {
					num -= subItem.num;
				} else {
					return false;
				}
				map[subItem.id] = num;
			}
		}
		return true;
	}
	reduceMerge(mergeArr: AnyRecord[], table: MergeTable, mergeActor: AnyRecord) {
		if (!Array.isArray(mergeArr) || !(table instanceof MergeTable)) {
			return false;
		}
		const inventory = mergeActor?.inventory;
		if (!inventory) {
			return false;
		}
		const map: AnyRecord = {};
		for (const subItem of table.item_list) {
			const obj = getById(mergeArr, subItem.id);
			if (table.list_op === "no_process") {
				if (obj instanceof Equipment) {
					inventory.deleteEquipment(subItem.id);
				}
				if (obj instanceof Item) {
					inventory.decreaseItems(subItem.id, subItem.num);
				}
				map[subItem.id] = true;
				continue;
			}
			if (!map.hasOwnProperty(subItem.id)) {
				if (
					table.list_op === "id_equal" &&
					(obj instanceof Equipment || obj instanceof Item)
				) {
					if (obj instanceof Equipment) {
						inventory.deleteEquipment(subItem.id);
					}
					if (obj instanceof Item) {
						inventory.decreaseItems(subItem.id, subItem.num);
					}
					map[subItem.id] = true;
					continue;
				}
				if (obj instanceof Equipment) {
					inventory.deleteEquipment(subItem.id);
					map[subItem.id] = countById(mergeArr, subItem.id) - 1;
					continue;
				}
				if (obj instanceof Item) {
					let num = countById(mergeArr, subItem.id);
					if (num >= subItem.num) {
						num -= subItem.num;
						inventory.decreaseItems(subItem.id, subItem.num);
					} else {
						return false;
					}
					map[subItem.id] = num;
					continue;
				}
				return false;
			} else {
				if (
					table.list_op === "id_equal" &&
					(obj instanceof Equipment || obj instanceof Item)
				) {
					if (obj instanceof Equipment) {
						inventory.deleteEquipment(subItem.id);
					}
					if (obj instanceof Item) {
						inventory.decreaseItems(subItem.id, subItem.num);
					}
					map[subItem.id] = true;
					continue;
				}
				let num = Number(map[subItem.id] ?? 0);
				if (num >= subItem.num) {
					num -= subItem.num;
					inventory.decreaseItems(subItem.id, subItem.num);
				} else {
					return false;
				}
				map[subItem.id] = num;
			}
		}
		return true;
	}
	convertItem(data: AnyRecord) {
		if (!data) {
			return undefined;
		}
		if (data.type === "item") {
			const itemData = Data.items[data.id];
			if (!itemData) {
				return undefined;
			}
			const item = new Item(itemData);
			item.quantity = data.num ?? 1;
			return item;
		}
		if (data.type === "equip") {
			const equipmentData = Data.equipments[data.id];
			if (!equipmentData) {
				return undefined;
			}
			return new Equipment(equipmentData);
		}
		return undefined;
	}
	mergeCall(table: MergeTable) {
		if (!table) {
			return undefined;
		}
		let result: Item | Equipment | undefined = undefined;
		if (table.out_op === "item") {
			result = new Item(table.model);
			result.quantity = 1;
		} else if (table.out_op === "equip") {
			result = new Equipment(table.model);
		}
		if (!result) {
			return undefined;
		}
		const baseAttributes: AnyRecord = { ...result.attributes };
		if (table.inherit_type !== "no_process") {
			const countMap: Record<string, number> = {};
			const valueMap: AnyRecord = {};
			for (const node of table.item_list) {
				let source: Item | Equipment | undefined;
				if (node.type === "item") {
					const itemData = Data.items[node.id];
					if (!itemData) {
						continue;
					}
					source = new Item(itemData);
				} else {
					const equipmentData = Data.equipments[node.id];
					if (!equipmentData) {
						continue;
					}
					source = new Equipment(equipmentData);
				}
				for (const key in source.attributes) {
					countMap[key] = (countMap[key] ?? 0) + 1;
					valueMap[key] = source.attributes[key];
				}
			}
			if (table.inherit_type === "bj_attr") {
				for (const key in valueMap) {
					baseAttributes[key] = valueMap[key];
				}
			}
			if (table.inherit_type === "jj_attr") {
				for (const key in countMap) {
					if (countMap[key] === table.item_list.length) {
						baseAttributes[key] = valueMap[key];
					}
				}
			}
		}
		result.attributes = baseAttributes;
		for (const node of table.put_list) {
			const rawKey = String(node.key);
			const key = resolveAttributeKey(table.attr_list, rawKey) ?? rawKey;
			if (!key) {
				continue;
			}
			if (node.type === "array") {
				if (node.arr.length === 0) {
					continue;
				}
				result.attributes[key] =
					node.arr[Math.floor(Math.random() * node.arr.length)];
				continue;
			}
			if (node.type === "range") {
				const left = Math.min(node.left, node.right);
				const right = Math.max(node.left, node.right);
				if (left === right) {
					result.attributes[key] = left;
				} else {
					result.attributes[key] =
						Math.floor(Math.random() * (right - left)) + left;
				}
				continue;
			}
			result.attributes[key] = node.val;
		}
		return result;
	}
}
