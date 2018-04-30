export const LAYOUT_INFO_SYMBOL = Symbol("layout info");
export type layout_info_id = string | number | symbol;
export interface LayoutAbleItem {
    [LAYOUT_INFO_SYMBOL]: {
        id: layout_info_id,
        scale: number
        width: string
        height: string
        col_index: number
        row_index: number
        visiable: boolean
    }
}
export type LayoutBound = {
    left: number,
    top: number,
    width: number,
    height: number,
    visiable: boolean
}
export interface Layout<T extends LayoutAbleItem> {
    add: (item: T) => boolean
    remove: (item: T) => boolean
    items: Set<T>;
    calcLauyout: (width: number, height: number) => Map<layout_info_id, LayoutBound>
}
function layoutParseStringToNumber(info: string, value: number) {
    let res_value = -1;
    let visiable = true;
    if (info.endsWith("%")) {// 百分比布局
        const per = parseFloat(info);
        if (isFinite(per)) {
            res_value = value * per;
            visiable = res_value >= 0;
        }
    } else if (isFinite(info as any)) { // 明确的宽度值
        res_value = parseFloat(info);
        visiable = res_value > 0;
    }
    return {
        value: res_value,
        visiable
    }
}
/**
 * 一行一行地排
 * TODO...
 */
export class RowLayout<T extends LayoutAbleItem> implements Layout<T>{
    constructor(
        public width = "auto",
        public height = "auto",
        public row_span = "2"
    ) { }
    rows: T[] = []
    items = new Set<T>();
    add(item: T) {
        if (!this.items.has(item)) {
            this.rows.push(item);
            this.items.add(item);
        }
        return true;
    }
    remove(item: T) { return false; }
    calcLauyout(width: number, height: number) {
        const res = new Map<layout_info_id, LayoutBound>();
        return res;
    }
}
/**
 * 一列一列地排
 */
export class ColLayout<T extends LayoutAbleItem> implements Layout<T>{
    constructor(
        public width = "auto",
        public height = "auto",
        public col_span = "2"
    ) { }
    cols: T[] = []
    items = new Set<T>();
    add(item: T) {
        if (!this.items.has(item)) {
            this.cols.push(item);
            this.items.add(item);
        }
        return true;
    }
    remove(item: T) {
        if (this.items.has(item)) {
            const index = this.cols.indexOf(item);
            if (index !== -1) {
                this.cols.splice(index, 1);
            }
            this.items.delete(item);
        }
        return true;
    }
    calcLauyout(width: number, height: number) {
        const res = new Map<layout_info_id, LayoutBound>();
        const auto_widthitems: T[] = [];
        let rest_width = width;
        // 根据可见元素数量显示相应数量的span空隙
        let visiable_item_num = this.cols.length;
        for (let item of this.cols) {
            const layout_info = item[LAYOUT_INFO_SYMBOL];
            const {
                value: item_width,
                visiable: item_visiable
            } = layoutParseStringToNumber(layout_info.width, width);
            const visiable = item_visiable && layout_info.visiable;
            layout_info.visiable = visiable;
            if (!visiable) {
                visiable_item_num -= 1;
                continue;
            }
            if (item_width !== -1) {
                rest_width -= item_width;
                res.set(layout_info.id, {
                    left: 0,
                    top: 0,
                    width: item_width,
                    height,
                    visiable
                });
            } else {// === 'auto' and other
                auto_widthitems.push(item);
            }
        }

        const col_span_info = layoutParseStringToNumber(this.col_span, width);

        const auto_item_width =
            Math.max(0
                , col_span_info.visiable
                    ? ((rest_width - (visiable_item_num + 1) * col_span_info.value) / visiable_item_num)
                    : (rest_width / visiable_item_num));
        let left_acc = col_span_info.value;
        // 设置宽度为auto的元素宽度
        for (let item of auto_widthitems) {
            const layout_info = item[LAYOUT_INFO_SYMBOL];
            res.set(layout_info.id, {
                left: 0,
                top: 0,
                width: auto_item_width,
                height,
                visiable: true
            })
        }
        // 设置left值
        for (let item of this.cols) {
            const layout_info = item[LAYOUT_INFO_SYMBOL];
            if (!layout_info.visiable) {
                continue;
            }
            const layout_bound = res.get(layout_info.id);
            if (layout_bound) {
                layout_bound.left = left_acc;
                left_acc += col_span_info.value + layout_bound.width;
            }
        }
        return res;
    }
}
/**
 * 网格Z型排
 * TODO...
 */
export class GridLayout<T extends LayoutAbleItem> implements Layout<T>{
    constructor(
        public width = "auto",
        public height = "auto",
        public row_span = "2",
        public col_span = "2"
    ) {
        this.buildGrid(this.row_num, this.col_num);
    }
    /**
     * row -> col
     * [ t1 , t2 ]
     * [ t3 , t4 ]
     */
    grid: T[][] = [[]]
    items = new Set<T>();
    get max_size() {
        return this.row_num * this.col_num
    }
    /**行数 */
    row_num = 1;
    /**列数 */
    col_num = 1;
    buildGrid(row_num = 2, col_num = 2) {
        const new_grid: T[][] = Array.from({ length: row_num }, () =>
            Array.from({ length: col_num })
        );
        for (let r = 0; r < row_num; r += 1) {
            new_grid[r] = Array.from({ length: col_num });
        }
        this.grid = new_grid;
        this.row_num = row_num;
        this.col_num = col_num;
        // 往新的表格里头填充
        for (let item of this.items) {
            if (!this.add(item)) {
                return;
            }
        }
    }
    private _auto_extend_grid = false;
    autoExtendGrid(auto_extend_grid) {
        this._auto_extend_grid = auto_extend_grid;
        return this;
    }
    add(item: T) {
        if (this.items.has(item)) {
            return true;
        }
        if (this.items.size >= this.max_size) {
            // 容不下了
            if (this._auto_extend_grid) {
                if (this.row_num > this.col_num) {
                    this.buildGrid(this.row_num, this.col_num + 1);
                } else {
                    this.buildGrid(this.row_num + 1, this.col_num);
                }
                return this.add(item);
            } else {
                return false;
            }
        }
        this.items.add(item);
        // Z型填充
        return this.grid.some(row => {
            for (let i = 0; i < row.length; i += 1) {
                if (!row[i]) {// 空位置，进行填充
                    row[i] = item;
                    return true;
                }
            }
            return false;
        });
    }
    remove(item: T) { return false; }
    calcLauyout(width: number, height: number) {
        const res = new Map<layout_info_id, LayoutBound>();
        return res;
    }
}