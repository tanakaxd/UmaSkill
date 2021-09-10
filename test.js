// ["ID","スキル名","取得pt(コツ0)","査定値","持続時間補正値","補正値"]
//　査定効率、チムレスコア効率(レアスキルかどうかという情報が必要)、効果量効率（速度スキルのみ）
//上位と下位でヒントレベルが違う場合があるので、効率を一括して計算することはできない
//おそらく理想的には上位スキルの差分を計算して新規レコードとして作るべき？
//指数の偏差値化
//脚質距離限定スキルの査定値補正

//オプション　脚質距離補正を含めるかどうか。ヒントレベル。よく使うスキル。サポカからの入手できるスキル。
// 表示する列の選択。スキル差分を作るかどうか。ソート方法。
// レコードに表示するかどうか、ヒントレベルの切り替えという項目を作る

//TODO debug トリック後

const table = [];//ロード時に作成し、これ自体はそれ以後改変しない。
const promises = [];

window.onload = onLoad;

const table_dom = document.getElementById("table");

const filter_dom = document.getElementById("filter");

const calcButton = document.getElementById('calcButton');
calcButton.addEventListener('click', () => {
    makeTable(table, "body",["ID","スキル名","取得pt(コツ0)","査定値","持続時間補正値","補正値"]);
});
const clearButton = document.getElementById('clearButton');
clearButton.addEventListener('click', () => {
    while (table_dom.firstChild) table_dom.removeChild(table_dom.firstChild);
});
const remove_negative_skill = document.getElementById('remove_negative_skill');
const remove_unique_skill = document.getElementById('remove_unique_skill');
const remove_inherited_skill = document.getElementById('remove_inherited_skill');
const remove_acceleration_skill = document.getElementById('remove_acceleration_skill');
// const checkButton = document.getElementById('');
// const checkButton = document.getElementById('');



function getOptions() {
    return {
        "remove_negative_skill": remove_negative_skill.checked,
        "remove_unique_skill": remove_unique_skill.checked,
        "remove_inherited_skill":remove_inherited_skill.checked,
    };
}

function onLoad() {
    promises.push(loadData("skill_effectiveness.json"));
    promises.push(loadData("skill_pt_hint.json"));

    Promise.all(promises)
        .then((results) => {
            // console.log(results[0]);
            results[0].forEach((record) => {
                const entry = {};
                Object.keys(record).forEach((col) => {
                    entry[col] = record[col];
                });
                table.push(entry);
            });
            // console.log(results[1]);

            results[1].forEach((record) => {
                for (const row of table) {
                    if (row["ID"]==record["ID"]) {
                        Object.keys(record).forEach((col) => {
                            row[col] = record[col];
                        });
                        // break;
                    }
                }
            });
        })
        .then(() => {
            //上位スキルのPT修正
            for (let index = 0; index < table.length; index++) {
                const record = table[index];
                if (record["査定値(上位スキル単独査定)"] != "-") {
                    record["取得pt(コツ0)"] += table[index + 1]["取得pt(コツ0)"];
                    //TODO スキル差分を作る    
                }
            }
            // console.log(table);

            makeTable(table, "body",["ID","スキル名","取得pt(コツ0)","査定値","持続時間補正値","補正値"],"ID");
        })
        .catch(err => { console.log(err) });
}

async function loadData(url) {
    let response = await fetch(url);
    let json = await response.json();
    return json;
}

// 表の動的作成
function makeTable(table_data, table_parent_Id, cols_name,sort_col) {

    console.log(table_data);
    while (table_dom.firstChild) table_dom.removeChild(table_dom.firstChild)
    
    const options = getOptions();


    const rows = [];
    // const table_dom = document.createElement("table");
    // table_dom.id = "table";
    const retreived_table = [];

    //必要列の抽出
    table_data.forEach((record) => {
        const row = {};
        cols_name.forEach((key) => {
            row[key] = record[key];
        });

        row["スキル説明"] = record["スキル説明"];
 
        if (row["スキル説明"].includes("＞")) {
            row["査定値"] = Math.floor(row["査定値"]*1.1);
        }
        
        // TODO ヒントレベルや適正によって変わる値
        //計算列の追加
        const temp = row["査定値"] / row["取得pt(コツ0)"];
        row["査定効率指数"] = Math.round(temp * 100) / 100;//TODO ◎スキルの仕様

        //TODO 簡易的表現
        const ratio = [10, 20, 30, 35, 40];
        for (let i = 0; i < ratio.length; i++) {
            row["Lv" + (i + 1)] = Math.round(row["査定効率指数"] * 100 / (100 - ratio[i]) * 100) / 100;
        }



        const score = record["査定値(上位スキル単独査定)"] == "-" ? 500 : row["スキル名"].endsWith("◎") ? 500 : 1200;
        row["チムレスコア効率指数"] = Math.round(score / row["取得pt(コツ0)"] * 100) / 100 ;
        const effectiveness = record["種類"] == "目標速度アップ"?row["補正値"] * row["持続時間補正値"]/ 10000/10000 :NaN;
        row["効果量(m)"] = effectiveness;
        row["効果量効率指数"] = Math.round(effectiveness/row["取得pt(コツ0)"] * 10000) ;
        
        retreived_table.push(row);
    });

    console.log(retreived_table);


    //filter, 固有スキルの除外,マイナススキルの除外
    //TODO 移動可能
    if (options["remove_negative_skill"]) {
        retreived_table.removeIf((elem,index) => 
            elem["査定値"] < 0
        )
    }

    if (options["remove_unique_skill"]) {
        retreived_table.removeIf((elem,index) => {
            return elem["取得pt(コツ0)"]=="固有";
        })
    }

    console.log(retreived_table);


    Array.from(filter_dom.children).removeIf((child) => {
        return child.firstChild.checked;
    })
    .forEach((child) => {
        retreived_table.removeIf((elem, index) => 
            elem["スキル説明"].includes(child.textContent)
        );
    });

    console.log(retreived_table);

    

    //並べ替え
    // console.log(retreived_table[1]["チムレスコア効率指数"]);
    // sortOnCol(retreived_table, "査定効率指数",false);
    // sortOnCol(retreived_table, "チムレスコア効率指数",false);
    // sortOnCol(retreived_table, "効果量効率指数",false);
    sortOnCol(retreived_table, sort_col,false,true);

    // retreived_table.sort((a, b) => a["ID"] - b["ID"]);
    // console.log(retreived_table.sort((a, b) => a["チムレスコア効率指数"] - b["チムレスコア効率指数"]));
    console.log(retreived_table);


    //header
    rows.push(table_dom.insertRow(-1));
    Object.keys(retreived_table[0]).forEach((col_label) => { //TODO index0の行が欠けていた場合バグ
        const cell = rows[0].insertCell(-1);
        cell.appendChild(document.createTextNode(col_label));
        cell.style.backgroundColor = "#bbb";
        cell.addEventListener("click", (e) => {
            console.log(e);
            console.log(e.path[0].innerText);
            // sortOnCol(retreived_table, e.path[0].innerText, false, true);
            makeTable(table, "body",["ID","スキル名","取得pt(コツ0)","査定値","持続時間補正値","補正値"],e.path[0].innerText);
            
        });
    });


    for(i = 0; i < retreived_table.length; i++){
        rows.push(table_dom.insertRow(-1));  // 行の追加。追加した行に対して列を追加できるようにrows配列いれておく

        Object.keys(retreived_table[i]).forEach((key) => {
            const cell = rows[i+1].insertCell(-1);
            cell.appendChild(document.createTextNode(retreived_table[i][key]));
            cell.style.backgroundColor = "#ddd"; // ヘッダ行以外
        });
    }
    // 指定したdiv要素に表を加える
    // document.getElementById(table_parent_Id).appendChild(table_dom);
}

function sortOnCol(table, col_label, ascending, include_NaN) {//数字しかソートできない
    // table.removeIf(x => Number.isNaN(x[col_label]));
    console.log(table);

    const temp = table.popIf(x => Number.isNaN(x[col_label]));
    console.log(temp);
    table.sort((a, b) => ascending ? a[col_label] - b[col_label] : b[col_label] - a[col_label]);
    if (include_NaN) {
        Array.prototype.push.apply(table, temp);
    }
    console.log(table);
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