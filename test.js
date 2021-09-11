// ["ID","スキル名","取得pt","査定値","持続時間補正値","補正値"]
//　査定効率、チムレスコア効率(レアスキルかどうかという情報が必要)、効果量効率（速度スキルのみ）
//上位と下位でヒントレベルが違う場合があるので、効率を一括して計算することはできない
//おそらく理想的には上位スキルの差分を計算して新規レコードとして作るべき？
//指数の偏差値化
//脚質距離限定スキルの査定値補正

//オプション　脚質距離補正を含めるかどうか。ヒントレベル。よく使うスキル。サポカから入手できるスキル。
// 表示する列の選択。スキル差分を作るかどうか。ソート方法。
// レコードに表示するかどうか、ヒントレベルの切り替えという項目を作る
//レコードとデータのデータバインディング

// ロードされたときjsonファイルからデータを取得し、合成したデータを作る。これを不変にする: table_data_raw
// ↓
// そこからキャッシュされたデータを作る。このデータは可変で、再計算の間中常に存続する: table_data_casched
// ↓
// キャッシュされたデータから表示させるため用のデータを抽出し、これをDOMに反映する: table_data_retreived

//TODO debug トリック後

const table_data_raw = [];//ロード時に作成し、これ自体はそれ以後改変しない。
const table_data_casched = [];//再計算の間存続する
const promises = [];
const sort_order = { "ID": false };//初期値はIDの降順が逆になり昇順。少し冗長
// const col_labels_data = ["ID", "スキル名", "取得pt(コツ0)", "査定値", "持続時間補正値", "補正値","スキル説明"];
const col_labels_view = ["ID", "スキル名", "ヒントLv","取得pt", "査定値", "査定効率指数", "チムレスコア効率指数", "効果量(m)", "効果量効率指数"];
const hint_ratio = {
    0: 0,
    1: 10,
    2: 20,
    3: 30,
    4: 35,
    5: 40,
};

window.onload = onLoad;

//DOM取得
const table_dom = document.getElementById("table");
const filter_dom = document.getElementById("filter");
const calcButton = document.getElementById('calcButton');
calcButton.addEventListener('click', () => {
    sort_order["ID"] = false;
    makeTable(table_data_casched, col_labels_view,"ID");
});
const clearButton = document.getElementById('clearButton');
clearButton.addEventListener('click', () => {
    while (table_dom.firstChild) table_dom.removeChild(table_dom.firstChild);
    init();
});
const remove_negative_skill = document.getElementById('remove_negative_skill');
const remove_unique_skill = document.getElementById('remove_unique_skill');
const remove_inherited_skill = document.getElementById('remove_inherited_skill');
const remove_acceleration_skill = document.getElementById('remove_acceleration_skill');
const modify_qualified_skill = document.getElementById('modify_qualified_skill');
// const checkButton = document.getElementById('');

function getOptions() {
    return {
        "remove_negative_skill": remove_negative_skill.checked,
        "remove_unique_skill": remove_unique_skill.checked,
        "remove_inherited_skill": remove_inherited_skill.checked,
        "modify_qualified_skill": modify_qualified_skill.checked,
    };
}

function init() {
    table_data_casched.forEach((record) => {
        //Toggleのための属性を追加
        record["選択"] = true;

        //ヒントレベルを追加
        record["ヒントLv"] = 0;

        //動的な取得ポイントを初期化
        // record["取得pt"] = record["取得pt(コツ0)"];
        record["取得pt"] = 0;

        //計算列の追加と初期化
        //査定効率
        const temp = record["査定値"] / record["取得pt(コツ0)"];
        record["査定効率指数"] = round(temp, 2);//TODO ◎スキルの仕様
    
        //チムレスコア効率指数
        const score = record["査定値(上位スキル単独査定)"] == "-" ? 500 : record["スキル名"].endsWith("◎") ? 500 : 1200;
        record["チムレスコア効率指数"] = round(score / record["取得pt(コツ0)"], 2);
    
        //効果量と効率
        const effectiveness = record["種類"] == "目標速度アップ" ? record["補正値"] * record["持続時間補正値"] / 10000 / 10000 : NaN;
        record["効果量(m)"] = effectiveness;
        record["効果量効率指数"] = round(effectiveness / record["取得pt(コツ0)"] * 10000, 2);
    });
}

function onLoad() {
    promises.push(loadData("skill_effectiveness.json"));
    promises.push(loadData("skill_pt_hint.json"));

    Promise.all(promises)
        .then((results) => {
            results[0].forEach((record) => {
                const entry = {};
                Object.keys(record).forEach((col) => {
                    entry[col] = record[col];
                });
                table_data_raw.push(entry);
            });
            results[1].forEach((record) => {
                for (const row of table_data_raw) {
                    if (row["ID"]==record["ID"]) {
                        Object.keys(record).forEach((col) => {
                            row[col] = record[col];
                        });
                        // IDかぶりのスキルがあるためbreakできない：嫁マヤ
                        // break;
                    }
                }
            });
        })
        .then(() => {
            //上位スキルのPT修正
            for (let index = 0; index < table_data_raw.length; index++) {
                const record = table_data_raw[index];
                if (record["査定値(上位スキル単独査定)"] != "-") {
                    record["取得pt(コツ0)"] += table_data_raw[index + 1]["取得pt(コツ0)"];
                    //TODO スキル差分を作る    
                }
            }
            //casched用にコピー
            table_data_raw.forEach((record) => {
                const row = {};
                Object.keys(record).forEach((col) => {
                    row[col] = record[col];
                });
                table_data_casched.push(row);
            });

            //キャッシュデータを初期化
            init();

            console.log(table_data_casched);

            makeTable(table_data_casched, col_labels_view,"ID");
        })
        .catch(err => { console.log(err) });
}

async function loadData(url) {
    let response = await fetch(url);
    let json = await response.json();
    return json;
}

// 表の動的作成
function makeTable(table_data, cols_name_to_view, sort_col) {

    //clear
    while (table_dom.firstChild) table_dom.removeChild(table_dom.firstChild);
    
    //ローカル変数宣言
    const options = getOptions();
    const rows = [];
    const retreived_table = [];

    //TODO オプション次第でキャッシュデータを修正する
    table_data.forEach((record) => {

        //適正補正
        if (options["modify_qualified_skill"]) {
            record["補正査定値"] = record["スキル説明"].includes("＞")? Math.floor(record["査定値"]*1.1):record["査定値"];
        }
        
        //計算列の追加。
        // キャッシュされているので適正補正反映のため毎回再計算する必要がある。これは冗長か？
        // どうせヒントレベルの反映もするのでokか？

        //ヒントレベルで取得ptを補正
        record["取得pt"]=record["取得pt(コツ0)"] *  (100 - hint_ratio[record["ヒントLv"]]) / 100;

        //査定効率
        const temp = record["補正査定値"] / record["取得pt"];
        record["査定効率指数"] = Math.round(temp * 100) / 100;//TODO ◎スキルの仕様

        //チムレスコア効率指数
        const score = record["査定値(上位スキル単独査定)"] == "-" ? 500 : record["スキル名"].endsWith("◎") ? 500 : 1200;
        record["チムレスコア効率指数"] = Math.round(score / record["取得pt"] * 100) / 100;
        
        //効果量効率
        record["効果量効率指数"] = Math.round(record["効果量(m)"]/record["取得pt"] * 10000) ;
    });

    console.log(table_data);

    //キャッシュを抽出データにコピー
    //TODO 抽出されたレコードへの変更がキャッシュにも反映されるようにしたほうがよいか？
    table_data.forEach((record) => {
        retreived_table.push(record);
    });

    //filter
    //TODO 選択されていないレコードの除外
    // 除外せず並び替えの時に下に行くだけの仕様の方がいいかもしれない
    // retreived_table.removeIf((ele, index) => 
    //     !ele["選択"]
    // );


    //マイナススキルの除外
    if (options["remove_negative_skill"]) {
        retreived_table.removeIf((elem,index) => 
            elem["査定値"] < 0
        )
    }
    //固有スキルの除外
    if (options["remove_unique_skill"]) {
        retreived_table.removeIf((elem,index) => 
            elem["取得pt(コツ0)"]=="固有"
        )
    }
    //継承スキルの除外
    if (options["remove_inherited_skill"]) {
        retreived_table.removeIf((elem, index) =>
            elem["ID"] >= 800000
        )
    }

    //適正スキルのフィルター
    Array.from(filter_dom.children).removeIf((child) => 
        child.firstChild.checked
    ).forEach((child) => {
        retreived_table.removeIf((elem, index) =>
            elem["スキル説明"].includes(child.textContent+"＞")
        );
    });

    //並べ替え
    sortOnCol(retreived_table, sort_col, true, true);
    
    console.log(retreived_table);

    //DOMへの反映
    //header
    rows.push(table_dom.insertRow(-1));

    //選択列
    const toggle_all_checked = rows[0].insertCell(-1);
    const input_dom = document.createElement("input");
    input_dom.type = "checkbox";
    input_dom.checked = true;
    input_dom.addEventListener("click",(e) => {
        //キャッシュデータを更新してチェックボックスDOMも更新する
        //ただしテーブルを作り直すとdeselect allされたとき全ての項目が消されてしまうことになる
        //よって、見かけと内部データは書き換えるが、テーブルの更新自体は行わない必要がある
        const is_checked = e.path[0].checked;
        console.log(is_checked);
        console.log(e.path);
        console.log(e.path[3].children);
        console.log(e.path[3].children[1].firstChild);
        console.log(e.path[3].children[1].firstChild.firstChild.checked);
        //DOMへの反映
        Array.from(e.path[3].children).forEach((record_dom) => {
            record_dom.firstChild.firstChild.checked = is_checked;
        });
        //内部データへの反映。キャッシュ、抽出は同じ参照
        retreived_table.forEach((record) => {
            record["選択"] = is_checked;
        });

        console.log(table_data_casched);
        console.log(retreived_table);

    });
    toggle_all_checked.appendChild(input_dom);

    //選択列以外のソート可能列
    cols_name_to_view.forEach((col_label) => { //TODO index0の行が欠けていた場合バグ
        const cell = rows[0].insertCell(-1);
        cell.appendChild(document.createTextNode(col_label));
        cell.style.backgroundColor = "#bbb";
        cell.addEventListener("click", (e) => {
            makeTable(table_data_casched, cols_name_to_view,e.path[0].innerText);
        });
    });

    //headerから下
    for(i = 0; i < retreived_table.length; i++){
        rows.push(table_dom.insertRow(-1));  // 行の追加。追加した行に対して列を追加できるようにrows配列いれておく

        //選択列
        const select_cell = rows[i + 1].insertCell(-1);
        const input_dom = document.createElement("input");
        input_dom.type = "checkbox";
        input_dom.checked = retreived_table[i]["選択"];
        input_dom.addEventListener("click",(e) => {
            //クリックしたスキルのIDを取得
            const id = e.path[2].children[1].innerText;
            // console.log(e.path[0].checked);
            const is_checked = e.path[0].checked;
            // キャッシュされたスキルテーブルにIDでアクセスして更新
            //単純なtoggle構造にできないのはこの操作以外のルートでDOMが更新される可能性があるから。
            //見かけと内部データが必ず一致するようにしてある
            const clicked_record = table_data_casched.find(ele => ele["ID"] == id);
            clicked_record["選択"] = is_checked;
        });
        select_cell.appendChild(input_dom);

        cols_name_to_view.forEach((key) => {
            const cell = rows[i+1].insertCell(-1);//rowsにはヘッダー行が入っているため+1から
            cell.appendChild(document.createTextNode(retreived_table[i][key]));
            cell.style.backgroundColor = "#ddd"; // ヘッダ行以外
        });
    }
}

function sortOnCol(table, sort_col, include_NaN, include_unselected) {//数字しかソートできない
    
    
    if (!(sort_col in sort_order)) {//keyがまだ存在しなかったら
        sort_order[sort_col] = false;
    } else {
        sort_order[sort_col] = !sort_order[sort_col];
    }
    // console.log(sort_order[sort_col]);
    
    //NaNを一時退避
    const nan_records = table.popIf(x => Number.isNaN(x[sort_col]));
    //選択されていないレコードを一時退避
    const unselected_records = table.popIf(x => !x["選択"]);
    
    //ソート
    table.sort((a, b) => sort_order[sort_col] ? a[sort_col] - b[sort_col] : b[sort_col] - a[sort_col]);
    //選択されていないものもソート
    unselected_records.sort((a, b) => sort_order[sort_col] ? a[sort_col] - b[sort_col] : b[sort_col] - a[sort_col]);

    //退避していたものを後ろにつなげる
    if (include_unselected) {
        Array.prototype.push.apply(table, unselected_records);
    }
    if (include_NaN) {
        Array.prototype.push.apply(table, nan_records);
    }

}

Array.prototype.removeIf = function(callback) {
    var i = this.length;
    while (i--) {
        if (callback(this[i],i)) {//callback(this[i], i)となっているが、おそらくpredicateにindex情報も渡せるような設計
            this.splice(i, 1);
        }
    }
    return this;
};

Array.prototype.popIf = function(callback) {
    var i = this.length;
    const arr = [];
    while (i--) {
        if (callback(this[i],i)) {
            arr.push(this.splice(i, 1)[0]);
        }
    }
    return arr;
};

function round(num, digit) {
    const exp = Math.pow(10, digit);
    return Math.round(num * exp) / exp;
}