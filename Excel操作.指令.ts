/*
@plugin Excel操作
@version 1.2
@author 徐然
@link https://space.bilibili.com/291565199
@desc

Excel操作
默认是从1开始
deps module: exceljs
PS：读取Excel文件，转换为二维数组在主事件运行，其他操作都是在回调事件运行
地址说明：获取行/列/单元格支持复合地址，格式为"列字母+行数字"（顺序无关，大小写均可），
例如 a1 表示 A列第1行、b2 表示 B列第2行、3c 表示 C列第3行。
获取行时复合地址用于指定"行+列偏移"（从该列开始取该行剩余）；
获取列时复合地址用于指定"列+行偏移"（从该行列开始取该列剩余）。


@option operation {'read','write','to-array','get-row','get-column','get-cell','reserve-array'}
@alias 操作类型 { 读取Excel文件,写入Excel文件,转换为二维数组,获取行,获取列,获取行列值,回送数组}
@desc
读取Excel文件：读取Excel文件
写入Excel文件：写入Excel文件（只能在回调事件中运行）
转换为二维数组：将Excel文件转换为二维数组
获取行：获取Excel文件中指定行的数据
获取列：获取Excel文件中指定列的数据
获取行列值：获取Excel文件中指定行列的值
回送数组：将二维数组回送到指定Excel对象中（类似于commit操作），当你修改数据后，需要调用此操作才能将已修改数据提交到Excel对象中


@variable-setter getterData
@alias 操作对象
@cond operation {'to-array','get-row','get-column','reserve-array'}

@string filePath
@alias 文件路径
@desc 
路径操作符：
$ ：指向当前Assets文件夹
% ：指向当前工程项目文件夹
也可以使用GUID
@cond operation {'read','write'}

@string outputVariableString
@alias 输出变量
@cond operation {'read'}

@number sheetIndex
@alias 工作表索引
@default 1
@desc 第几个工作表，默认从1开始
@cond operation {'to-array'}


@boolean inhertEvent
@alias 继承
@default false
@desc 继承事件上下文
@cond operation {'to-array'}


@file commandFile
@alias 回调事件
@desc 
本地变量：@index-> 工作表索引、@result-> 转换过后的数据

@filter command
@cond operation {'to-array'}

@number Index
@alias 索引
@desc 默认从1开始（行），支持复合地址（如 a1/b2），用于指定行并从该列开始取行剩余数据
@default 1
@cond operation { 'get-row','get-cell'}

@string IndexColumn
@alias 索引
@desc 默认从1开始（列），可使用字母A-Z，或复合地址（如 a1/b2/3c）指定列并从该行列开始取列剩余数据
@default 1
@cond operation {'get-column','get-cell'}

@boolean noEmpty
@alias 忽略空值
@default false
@cond operation {'get-row','get-column'}


@variable-setter outputVariableRow
@alias 输出变量
@cond operation {'get-row'}
@variable-setter outputVariableColumn
@alias 输出变量
@cond operation {'get-column'}
@variable-setter outputVariableCell
@alias 输出变量
@cond operation {'get-cell'}
*/

// @ts-ignore
const ExcelJSEx = ExcelJS as any;
if (!ExcelJSEx) {
	console.warn("未找到ExcelJS模块，请安装exceljs模块");
}
const fs = require("fs");

const ExcelOperations = new (class {
	// 创建新的工作簿
	createWorkbook() {
		return new ExcelJSEx.Workbook();
	}

	// 读取Excel文件
	async readExcel(filePath: string | Buffer) {
		const workbook = this.createWorkbook();
		await workbook.xlsx.load(filePath);
		return workbook;
	}

	// 保存Excel文件
	async saveExcel(workbook: any, filePath: string) {
		await workbook.xlsx.writeFile(filePath);
	}

	// 获取工作表
	getWorksheet(workbook: any, sheetIndex: number) {
		return workbook.getWorksheet(sheetIndex);
	}

	// 获取单元格值
	getCellValue(worksheet: any, row: number, col: number) {}

	// 设置单元格值
	setCellValue(worksheet: any, row: number, col: number, value: any) {
		worksheet.getCell(row, col).value = value;
	}
})();

export default class ExcelOperationsCommand implements Script<Command> {
	// 接口属性
	operation!:
		| "read"
		| "write"
		| "to-array"
		| "get-row"
		| "get-column"
		| "get-cell"
		| "reserve-array";
	filePath!: string;
	commandFile!: string;
	Index!: number;
	IndexColumn!: number | string;
	sheetIndex!: number;
	getterData?: VariableSetter;
	outputVariableRow?: VariableSetter;
	outputVariableColumn?: VariableSetter;
	outputVariableCell?: VariableSetter;
	outputVariableString!: string;
	noEmpty!: boolean;
	inhertEvent!: boolean;

	// 解析单元格复合地址(如 a1/b2/3c)，返回1-based的行与列
	parseCellRef(ref: string | number): { row: number; col: number } {
		if (typeof ref === "number") {
			// 纯数字：作为行号，列从1开始
			return { row: ref, col: 1 };
		}
		let row = 0;
		let col = 0;
		for (let i = 0; i < ref.length; i++) {
			const ch = ref.charCodeAt(i);
			if (ch >= 48 && ch <= 57) {
				// 数字 -> 行
				row = row * 10 + (ch - 48);
			} else if (ch >= 65 && ch <= 90) {
				// 大写字母 -> 列
				col = col * 26 + (ch - 64);
			} else if (ch >= 97 && ch <= 122) {
				// 小写字母 -> 列
				col = col * 26 + (ch - 96);
			}
		}
		if (col < 1) col = 1;
		if (row < 1) row = 1;
		return { row, col };
	}

	// 获取指定行数据（支持行号或复合地址a1/b2作为行+列偏移）
	getRow(
		sheetData: string | any[],
		rowIndex: number | string,
		noEmpty: boolean = false,
	) {
		let rowNum: number;
		let colOffset = 1;
		if (typeof rowIndex === "string") {
			const ref = this.parseCellRef(rowIndex);
			rowNum = ref.row;
			colOffset = ref.col;
		} else {
			rowNum = rowIndex;
		}
		if (rowNum < 1 || rowNum > sheetData.length) {
			throw new Error(`行索引超出范围 (1-${sheetData.length})`);
		}
		const source = sheetData[rowNum - 1];
		const slice = source.slice(colOffset - 1);
		if (noEmpty) {
			return slice.filter((cell: any) => cell !== null);
		}
		return [...slice];
	}

	// 获取指定列数据（支持列字母/数字或复合地址a1/b2作为列+行偏移）
	getColumn(
		sheetData: any[],
		columnIdentifier: string | number,
		noEmpty: boolean = false,
	) {
		let colIndex = 0;
		let rowOffset = 1;

		if (typeof columnIdentifier === "string") {
			// 复合地址：解析为列+行偏移
			const ref = this.parseCellRef(columnIdentifier);
			colIndex = ref.col;
			rowOffset = ref.row;
			if (colIndex < 1) throw new Error("列索引不能小于1");
		} else {
			colIndex = columnIdentifier;
		}
		if (colIndex < 1) throw new Error("列索引不能小于1");

		let data = sheetData;
		if (rowOffset > 1) {
			data = data.slice(rowOffset - 1);
		}

		if (noEmpty) {
			data = data.filter(
				(row: any[]) =>
					row[colIndex - 1] !== null && row[colIndex - 1] !== undefined,
			);
		}

		return data.map((row: string | any[]) => {
			// 检查行是否有足够的列
			return row.length >= colIndex ? row[colIndex - 1] : null;
		});
	}

	// 获取指定行列的值（支持列字母/数字或复合地址）
	getCell(sheetData: any[], rowIndex: string | number, colIndex: number | string) {
		let rowIndexNumber: number;
		let colIndexNumber: number;

		if (typeof rowIndex === "string") {
			const ref = this.parseCellRef(rowIndex);
			rowIndexNumber = ref.row;
			colIndexNumber = ref.col;
		} else {
			rowIndexNumber = rowIndex;
			colIndexNumber =
				typeof colIndex === "string"
					? this.parseCellRef(colIndex).col
					: colIndex;
		}
		if (colIndexNumber < 1) throw new Error("列索引不能小于1");
		if (rowIndexNumber < 1 || rowIndexNumber > sheetData.length) {
			throw new Error(`行索引超出范围 (1-${sheetData.length})`);
		}
		const row = sheetData[rowIndexNumber - 1];
		return row.length >= colIndexNumber ? row[colIndexNumber - 1] : null;
	}

	transformPath(text: string) {
		const trans_char = (__text = __dirname) => {
			let _path_local = __text.replace(/\\/, "/");
			while (/\\/.test(_path_local)) {
				_path_local = _path_local.replace(/\\/, "/");
			}
			return _path_local;
		};
		if (text.startsWith("$")) {
			text = text.slice(1, text.length);
			return trans_char(Loader.route("Assets")) + "/" + text;
		} else if (text.startsWith("%")) {
			text = text.slice(1, text.length);
			return trans_char(Loader.route("")) + "/" + text;
		}
		if (/[a-f0-9]{16}/i.test(text) && Loader.getPathByGUID(text).length > 0) {
			return trans_char(__dirname) + "/" + Loader.getPathByGUID(text);
		} else {
			return text;
		}
	}

	call() {
		switch (this.operation) {
			case "read": {
				const outputVariableString = this.outputVariableString;
				const host = CurrentEvent;
				try {
					const buffer = fs.readFileSync(this.transformPath(this.filePath));
					// 挂起主事件，等待读取完成再继续
					host.pause();
					ExcelOperations.readExcel(buffer)
						.then((data: any) => {
							// 将读取到的Excel对象存储到变量中
							Attribute.OBJECT_SET(host.attributes, outputVariableString, data);
						})
						.catch((error: any) => {
							console.warn("读取Excel文件失败", error);
						})
						.finally(() => host.continue());
				} catch (error) {
					console.warn("读取Excel文件失败", error);
					host.continue();
				}
				return false;
			}
			case "to-array": {
				const sheet = this.getterData?.get() as any;
				if (!sheet) return true;
				// 在同步阶段捕获参数，避免单例脚本实例被后续指令覆盖
				const commandFile = this.commandFile;
				const sheetIndex = this.sheetIndex;
				const inhertEvent = this.inhertEvent;
				const host = CurrentEvent;
				// 兼容 Promise(read旧数据) 与 workbook对象(read新数据)
				const workbookPromise = typeof sheet.then === "function"
					? sheet
					: Promise.resolve(sheet);
				// 挂起主事件，等待转换与回调事件完成后再继续下一条指令
				workbookPromise.then((r: any) => {
					// 初始化二维数组
					const data: any = [];
					const worksheet = r.getWorksheet(sheetIndex);
					// 遍历工作表的每一行
					worksheet.eachRow(
						{ includeEmpty: true },
						(row: {
							eachCell: (
								arg0: { includeEmpty: boolean },
								arg1: (cell: any, colNumber: any) => void,
							) => void;
						}) => {
							const rowData: any[] = [];
							// 遍历当前行的每个单元格
							row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
								// 获取单元格值（空单元格为 null）
								rowData.push(cell.value === undefined ? null : cell.value);
							});

							data.push(rowData);
						},
					);
					const commands = EventManager.guidMap[commandFile];
					if (commands) {
						const e = new EventHandler(commands);
						if (inhertEvent) e.inheritEventContext(host);
						Object.defineProperty(e, "excelTarget", {
							value: r,
							enumerable: true,
						});
						Attribute.SET(e.attributes, "@index", sheetIndex);
						Attribute.OBJECT_SET(e.attributes, "@result", data);
						// 回调事件完成后恢复主事件
						host.pause();
						e.onFinish(() => host.continue());
						EventHandler.call(e);
					} else {
						host.continue();
					}
					return r;
				}).catch((error: any) => {
					console.warn("转换Excel文件失败", error);
					host.continue();
				});
				return false;
			}
			case "write": {
				const workbook = (CurrentEvent as any).excelTarget;
				if (!workbook) {
					console.warn("请在回调事件中保存工作表，否则无法写入Excel文件");
					return;
				}
				const p = this.filePath;
				const index = CurrentEvent.attributes["@index"];
				try {
					workbook.then((workbook: any) => {
						// 保存到文件
						const finalPath = this.transformPath(p);
						const worksheet = workbook.getWorksheet(index);
						const data: any[][] = [];
						// 遍历工作表的每一行
						worksheet.eachRow(
							{ includeEmpty: true },
							(row: {
								eachCell: (
									arg0: { includeEmpty: boolean },
									arg1: (cell: any, colNumber: any) => void,
								) => void;
							}) => {
								const rowData: any[] = [];
								// 遍历当前行的每个单元格
								row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
									// 获取单元格值（空单元格为 null）
									rowData.push(cell.value === undefined ? null : cell.value);
								});

								data.push(rowData);
							},
						);
						workbook.xlsx.writeBuffer(finalPath).then((bf: any) => {
							fs.writeFileSync(finalPath, bf);
						});
						return workbook;
					});
				} catch (error) {
					console.error("写入Excel文件失败:", error);
				}
				break;
			}
			case "get-row": {
				const data = this.getterData?.get() as any;
				if (!data) return;
				this.outputVariableRow?.set(
					this.getRow(data, this.Index, this.noEmpty),
				);
				break;
			}
			case "get-column": {
				const data = this.getterData?.get() as any;
				if (!data) return;
				this.outputVariableColumn?.set(
					this.getColumn(data, this.IndexColumn, this.noEmpty),
				);
				break;
			}
			case "get-cell": {
				const data = this.getterData?.get() as any;
				if (!data) return;
				this.outputVariableCell?.set(
					this.getCell(data, this.IndexColumn, this.Index),
				);
				break;
			}
			case "reserve-array": {
				const data = this.getterData?.get() as any[][];
				if (!data) return;
				const target = (CurrentEvent as any).excelTarget;
				if (!target) {
					console.warn("请在回调事件中保存工作表，否则无法回送数组");
					return;
				}
				const index = CurrentEvent.attributes["@index"];
				Promise.resolve().then(() => {
					target.then((r: any) => {
						const worksheet = r.getWorksheet(index);
						// 清空现有工作表
						worksheet.spliceRows(0, worksheet.rowCount);
						// 将二维数组写入工作表
						data.forEach((rowData, rowIdx) => {
							const row = worksheet.getRow(rowIdx + 1);
							rowData.forEach((cellValue, colIdx) => {
								row.getCell(colIdx + 1).value = cellValue;
							});
							row.commit();
						});
						return r;
					});
				});
				break;
			}
		}
	}
}
