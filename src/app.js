let appData = {
    users: {},
    currentUser: null,
    incomes: [],
    loans: []
};

let chartInstance = null;
let editModal = null;
let selectedLoanId = null;

function formatRial(amount) {
    const num = parseInt(amount) || 0;
    return num.toLocaleString('fa-IR') + ' ریال';
}

function parseInputNumber(str) {
    if (!str) return 0;
    const persianToEnglish = String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    return parseInt(persianToEnglish.replace(/[^0-9]/g, '')) || 0;
}

function autoFormatDateInput(elId) {
    const el = document.getElementById(elId);
    if (el) {
        el.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9]/g, '');
            if (val.length > 4 && val.length <= 6) {
                val = val.slice(0, 4) + '/' + val.slice(4);
            } else if (val.length > 6) {
                val = val.slice(0, 4) + '/' + val.slice(4, 6) + '/' + val.slice(6, 8);
            }
            e.target.value = val;
        });
    }
}

function parseJalaliDateToNumber(dateStr) {
    if (!dateStr) return 0;
    const enStr = String(dateStr).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const parts = enStr.replace(/[^0-9\/]/g, '').split('/');
    if (parts.length !== 3) return 0;
    
    const year = parseInt(parts[0]) || 0;
    const month = parseInt(parts[1]) || 0;
    const day = parseInt(parts[2]) || 0;
    
    return year * 10000 + month * 100 + day;
}

function addMonthsToJalali(dateStr, monthIncrement) {
    if (!dateStr || dateStr.length < 8) return '';
    const enStr = String(dateStr).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const parts = enStr.split('/');
    if (parts.length !== 3) return dateStr;

    let year = parseInt(parts[0]) || 1403;
    let month = (parseInt(parts[1]) || 1) + monthIncrement;
    let day = parseInt(parts[2]) || 1;

    while (month > 12) {
        month -= 12;
        year += 1;
    }

    const yearStr = String(year);
    const monthStr = month < 10 ? '0' + month : String(month);
    const dayStr = day < 10 ? '0' + day : String(day);

    return yearStr + '/' + monthStr + '/' + dayStr;
}

function getCurrentJalaliDateStr() {
    try {
        const d = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const enStr = String(d).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        return enStr;
    } catch (e) {
        return "1403/01/01";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    editModal = new bootstrap.Modal(document.getElementById('editInstallmentModal'));
    setupAuthEvents();
    setupFormEvents();
    
    ['incDate', 'loanReceiveDate', 'loanFirstDueDate', 'editInstDueDate', 'editInstPayDate'].forEach(autoFormatDateInput);
    
    checkSavedSession();
});

function setupAuthEvents() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('authUsername').value.trim();
        const pass = document.getElementById('authPassword').value.trim();
        const remember = document.getElementById('rememberMe').checked;

        if (!user || !pass) return;

        if (appData.users[user]) {
            if (appData.users[user] !== pass) {
                alert('رمز عبور اشتباه است.');
                return;
            }
        } else {
            appData.users[user] = pass;
            saveLocalData();
        }

        appData.currentUser = user;
        if (remember) {
            localStorage.setItem('saved_user', user);
        } else {
            localStorage.removeItem('saved_user');
        }

        showMainApp();
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        appData.currentUser = null;
        localStorage.removeItem('saved_user');
        document.getElementById('mainApp').classList.add('d-none');
        document.getElementById('authScreen').classList.remove('d-none');
    });
}

function checkSavedSession() {
    const savedUser = localStorage.getItem('saved_user');
    if (savedUser && appData.users[savedUser]) {
        appData.currentUser = savedUser;
        document.getElementById('authUsername').value = savedUser;
        document.getElementById('authPassword').value = appData.users[savedUser];
        document.getElementById('rememberMe').checked = true;
        showMainApp();
    }
}

function showMainApp() {
    document.getElementById('currentUserDisplay').innerText = appData.currentUser;
    document.getElementById('authScreen').classList.add('d-none');
    document.getElementById('mainApp').classList.remove('d-none');
    renderAll();
}

function setupFormEvents() {
    const numberInputs = ['incAmount', 'loanTotal', 'loanInstallmentAmount', 'editInstAmount'];
    numberInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                let val = parseInputNumber(e.target.value);
                e.target.value = val ? val.toLocaleString('fa-IR') : '';
            });
        }
    });

    document.getElementById('incomeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = document.getElementById('incEditId').value;
        const title = document.getElementById('incTitle').value;
        const amount = parseInputNumber(document.getElementById('incAmount').value);
        const date = document.getElementById('incDate').value;

        if (editId) {
            const item = appData.incomes.find(i => i.id == editId);
            if (item) {
                item.title = title;
                item.amount = amount;
                item.date = date;
            }
            document.getElementById('incEditId').value = '';
            document.getElementById('btnIncSave').innerText = 'ذخیره درآمد';
        } else {
            appData.incomes.push({ id: Date.now(), title, amount, date });
        }

        saveLocalData();
        e.target.reset();
        renderAll();
    });

    document.getElementById('loanForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = document.getElementById('loanEditId').value;
        const title = document.getElementById('loanTitle').value;
        const total = parseInputNumber(document.getElementById('loanTotal').value);
        const receiveDate = document.getElementById('loanReceiveDate').value;
        const firstDueDate = document.getElementById('loanFirstDueDate').value;
        const count = parseInt(document.getElementById('loanInstallmentCount').value) || 1;
        const instAmount = parseInputNumber(document.getElementById('loanInstallmentAmount').value);

        if (editId) {
            const loan = appData.loans.find(l => l.id == editId);
            if (loan) {
                loan.title = title;
                loan.totalAmount = total;
                loan.receiveDate = receiveDate;
                loan.firstDueDate = firstDueDate;
                loan.count = count;
                loan.installmentAmount = instAmount;
                if (loan.installments.length !== count) {
                    loan.installments = [];
                    for (let i = 0; i < count; i++) {
                        const dueDate = addMonthsToJalali(firstDueDate, i);
                        loan.installments.push({ num: i + 1, amount: instAmount, dueDate, isPaid: false, payDate: '' });
                    }
                }
            }
            document.getElementById('loanEditId').value = '';
            document.getElementById('btnLoanSave').innerText = 'ذخیره مشخصات وام';
        } else {
            let installments = [];
            for (let i = 0; i < count; i++) {
                const dueDate = addMonthsToJalali(firstDueDate, i);
                installments.push({ num: i + 1, amount: instAmount, dueDate, isPaid: false, payDate: '' });
            }
            const newLoan = { id: Date.now(), title, totalAmount: total, receiveDate, firstDueDate, count, installmentAmount: instAmount, installments };
            appData.loans.push(newLoan);
            selectedLoanId = newLoan.id;
        }

        saveLocalData();
        e.target.reset();
        renderAll();
    });

    document.getElementById('loanSelectDropdown').addEventListener('change', (e) => {
        selectedLoanId = e.target.value ? parseInt(e.target.value) : null;
        renderInstallmentsArea();
    });
}

function renderAll() {
    renderDashboard();
    renderIncomes();
    populateLoanDropdown();
    renderInstallmentsArea();
    renderReports();
}

function renderDashboard() {
    const totalIncome = appData.incomes.reduce((sum, item) => sum + item.amount, 0);
    let totalRemainingLoans = 0;
    
    appData.loans.forEach(loan => {
        loan.installments.forEach(inst => {
            if (!inst.isPaid) totalRemainingLoans += inst.amount;
        });
    });

    const netBalance = totalIncome - totalRemainingLoans;

    document.getElementById('dashTotalIncome').innerText = formatRial(totalIncome);
    document.getElementById('dashTotalLoans').innerText = formatRial(totalRemainingLoans);
    document.getElementById('dashNetBalance').innerText = formatRial(netBalance);
}

function renderIncomes() {
    const tbody = document.getElementById('incomeTableBody');
    tbody.innerHTML = '';

    appData.incomes.forEach(inc => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + inc.title + '</td>' +
                       '<td>' + formatRial(inc.amount) + '</td>' +
                       '<td>' + inc.date + '</td>' +
                       '<td class="text-center">' +
                           '<button class="btn btn-outline-primary btn-sm me-1" onclick="editIncome(' + inc.id + ')"><i class="bi bi-pencil"></i></button>' +
                           '<button class="btn btn-outline-danger btn-sm" onclick="deleteIncome(' + inc.id + ')"><i class="bi bi-trash"></i></button>' +
                       '</td>';
        tbody.appendChild(tr);
    });
}

function populateLoanDropdown() {
    const dropdown = document.getElementById('loanSelectDropdown');
    dropdown.innerHTML = '<option value="">-- هیچ وامی انتخاب نشده است --</option>';

    appData.loans.forEach(loan => {
        const opt = document.createElement('option');
        opt.value = loan.id;
        opt.innerText = loan.title + ' (دریافت: ' + (loan.receiveDate || '-') + ' | کل: ' + formatRial(loan.totalAmount) + ')';
        if (selectedLoanId && selectedLoanId === loan.id) {
            opt.selected = true;
        }
        dropdown.appendChild(opt);
    });
}

function getInstallmentStatus(inst) {
    if (inst.isPaid) return { code: 'paid', label: 'پرداخت شده', badgeClass: 'status-badge-paid', boxClass: 'status-paid' };

    const todayStr = getCurrentJalaliDateStr();
    const todayNum = parseJalaliDateToNumber(todayStr);
    const dueNum = parseJalaliDateToNumber(inst.dueDate);

    if (dueNum > 0 && todayNum > 0) {
        if (dueNum < todayNum) {
            return { code: 'overdue', label: 'معوق (سررسید گذشته)', badgeClass: 'status-badge-overdue', boxClass: 'status-overdue' };
        }
    }
    return { code: 'current', label: 'جاری', badgeClass: 'status-badge-current', boxClass: 'status-current' };
}

function renderInstallmentsArea() {
    const container = document.getElementById('installmentsDisplayArea');
    const actionsDiv = document.getElementById('selectedLoanActions');
    container.innerHTML = '';
    actionsDiv.innerHTML = '';

    if (!selectedLoanId) {
        container.innerHTML = '<div class="text-center py-5 text-muted">' +
                                  '<i class="bi bi-arrow-up-circle fs-1 opacity-25"></i>' +
                                  '<p class="mt-2">لطفاً از منوی بالا یک وام را انتخاب کنید تا اقساط آن نمایش داده شوند.</p>' +
                              '</div>';
        return;
    }

    const loan = appData.loans.find(l => l.id === selectedLoanId);
    if (!loan) return;

    actionsDiv.innerHTML = '<button class="btn btn-outline-primary btn-sm me-2" onclick="editLoan(' + loan.id + ')"><i class="bi bi-pencil me-1"></i>ویرایش مشخصات وام</button>' +
                           '<button class="btn btn-outline-danger btn-sm" onclick="deleteLoan(' + loan.id + ')"><i class="bi bi-trash me-1"></i>حذف وام</button>';

    const paidCount = loan.installments.filter(i => i.isPaid).length;

    let cardsHtml = '<div class="mb-3 p-3 bg-light rounded-3 d-flex flex-wrap justify-content-between align-items-center">' +
                        '<div>' +
                            '<h5 class="fw-bold text-dark mb-1">' + loan.title + '</h5>' +
                            '<small class="text-muted me-3"><i class="bi bi-calendar-event me-1"></i>تاریخ دریافت: ' + (loan.receiveDate || '-') + '</small>' +
                            '<small class="text-muted"><i class="bi bi-flag me-1"></i>اولین قسط: ' + (loan.firstDueDate || '-') + '</small>' +
                        '</div>' +
                        '<div>' +
                            '<span class="badge bg-primary fs-6 px-3 py-2">' + paidCount + ' از ' + loan.count + ' قسط پرداخت شده</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="row g-3">';

    loan.installments.forEach((inst, idx) => {
        const st = getInstallmentStatus(inst);
        const btnClass = inst.isPaid ? 'btn-success' : (st.code === 'overdue' ? 'btn-danger' : 'btn-outline-primary');
        const btnText = inst.isPaid ? 'پرداخت شده' : 'پرداخت قسط';
        
        const dueDateHtml = inst.dueDate ? '<div class="small text-muted mt-1"><i class="bi bi-clock me-1"></i>سررسید: ' + inst.dueDate + '</div>' : '';
        const payDateHtml = inst.payDate ? '<div class="small text-success mt-1 fw-bold"><i class="bi bi-check-all me-1"></i>واریز: ' + inst.payDate + '</div>' : '';

        cardsHtml += '<div class="col-md-3 col-sm-6">' +
                        '<div class="inst-box ' + st.boxClass + '">' +
                            '<div class="d-flex justify-content-between align-items-center mb-2">' +
                                '<span class="fw-bold small">قسط ' + inst.num + '</span>' +
                                '<span class="badge ' + st.badgeClass + ' small">' + st.label + '</span>' +
                            '</div>' +
                            '<div class="fs-6 fw-bold text-dark my-1">' + formatRial(inst.amount) + '</div>' +
                            dueDateHtml +
                            payDateHtml +
                            '<div class="d-flex gap-1 mt-3">' +
                                '<button class="btn btn-sm ' + btnClass + ' flex-grow-1" onclick="toggleInstallment(' + loan.id + ',' + idx + ')">' + btnText + '</button>' +
                                '<button class="btn btn-sm btn-outline-secondary" onclick="openInstEdit(' + loan.id + ',' + idx + ')" title="ویرایش جزئیات"><i class="bi bi-pencil"></i></button>' +
                            '</div>' +
                        '</div>' +
                     '</div>';
    });

    cardsHtml += '</div>';
    container.innerHTML = cardsHtml;
}

function renderReports() {
    document.getElementById('reportGeneratedDate').innerText = getCurrentJalaliDateStr();
    document.getElementById('reportUser').innerText = appData.currentUser || '-';

    const totalIncome = appData.incomes.reduce((sum, item) => sum + item.amount, 0);
    let totalRemainingLoans = 0;
    let totalInsts = 0;
    let paidInsts = 0;

    const tbody = document.getElementById('reportLoanTable');
    tbody.innerHTML = '';

    appData.loans.forEach(loan => {
        let loanRem = 0;
        loan.installments.forEach(i => {
            totalInsts++;
            if (i.isPaid) paidInsts++;
            else loanRem += i.amount;
        });
        totalRemainingLoans += loanRem;

        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + loan.title + '</td>' +
                       '<td>' + (loan.receiveDate || '-') + '</td>' +
                       '<td>' + (loan.firstDueDate || '-') + '</td>' +
                       '<td>' + formatRial(loan.totalAmount) + '</td>' +
                       '<td>' + loan.installments.filter(i => i.isPaid).length + ' از ' + loan.count + '</td>' +
                       '<td>' + formatRial(loanRem) + '</td>';
        tbody.appendChild(tr);
    });

    const ratio = totalInsts > 0 ? Math.round((paidInsts / totalInsts) * 100) : 0;

    document.getElementById('reportTotalInc').innerText = formatRial(totalIncome);
    document.getElementById('reportTotalRem').innerText = formatRial(totalRemainingLoans);
    document.getElementById('reportRatio').innerText = ratio + '%';

    const ctx = document.getElementById('financeChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['مجموع درآمدها', 'مانده کل اقساط'],
            datasets: [{
                label: 'مبلغ (ریال)',
                data: [totalIncome, totalRemainingLoans],
                backgroundColor: ['#10b981', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
}

function editIncome(id) {
    const item = appData.incomes.find(i => i.id === id);
    if (!item) return;
    document.getElementById('incEditId').value = item.id;
    document.getElementById('incTitle').value = item.title;
    document.getElementById('incAmount').value = item.amount.toLocaleString('fa-IR');
    document.getElementById('incDate').value = item.date;
    document.getElementById('btnIncSave').innerText = 'به‌روزرسانی درآمد';
}

function deleteIncome(id) {
    appData.incomes = appData.incomes.filter(i => i.id !== id);
    saveLocalData();
    renderAll();
}

function editLoan(id) {
    const loan = appData.loans.find(l => l.id === id);
    if (!loan) return;
    document.getElementById('loanEditId').value = loan.id;
    document.getElementById('loanTitle').value = loan.title;
    document.getElementById('loanTotal').value = loan.totalAmount.toLocaleString('fa-IR');
    document.getElementById('loanReceiveDate').value = loan.receiveDate || '';
    document.getElementById('loanFirstDueDate').value = loan.firstDueDate || '';
    document.getElementById('loanInstallmentCount').value = loan.count;
    document.getElementById('loanInstallmentAmount').value = loan.installmentAmount.toLocaleString('fa-IR');
    document.getElementById('btnLoanSave').innerText = 'به‌روزرسانی مشخصات وام';
}

function deleteLoan(id) {
    appData.loans = appData.loans.filter(l => l.id !== id);
    if (selectedLoanId === id) selectedLoanId = null;
    saveLocalData();
    renderAll();
}

function toggleInstallment(loanId, instIndex) {
    const loan = appData.loans.find(l => l.id === loanId);
    if (loan && loan.installments[instIndex]) {
        loan.installments[instIndex].isPaid = !loan.installments[instIndex].isPaid;
        if (loan.installments[instIndex].isPaid && !loan.installments[instIndex].payDate) {
            loan.installments[instIndex].payDate = getCurrentJalaliDateStr();
        }
        saveLocalData();
        renderAll();
    }
}

function openInstEdit(loanId, instIndex) {
    const loan = appData.loans.find(l => l.id === loanId);
    if (!loan || !loan.installments[instIndex]) return;

    document.getElementById('editInstLoanId').value = loanId;
    document.getElementById('editInstIndex').value = instIndex;
    document.getElementById('editInstAmount').value = loan.installments[instIndex].amount.toLocaleString('fa-IR');
    document.getElementById('editInstDueDate').value = loan.installments[instIndex].dueDate || '';
    document.getElementById('editInstPayDate').value = loan.installments[instIndex].payDate || '';
    editModal.show();
}

function saveInstallmentEdit() {
    const loanId = parseInt(document.getElementById('editInstLoanId').value);
    const idx = parseInt(document.getElementById('editInstIndex').value);
    const amount = parseInputNumber(document.getElementById('editInstAmount').value);
    const payDate = document.getElementById('editInstPayDate').value;
    const dueDateInputVal = document.getElementById('editInstDueDate').value;

    const loan = appData.loans.find(l => l.id === loanId);
    if (loan && loan.installments[idx]) {
        loan.installments[idx].amount = amount;
        loan.installments[idx].dueDate = dueDateInputVal;
        loan.installments[idx].payDate = payDate;
        saveLocalData();
        renderAll();
        editModal.hide();
    }
}

function exportToPDF() {
    window.print();
}

function exportToImage() {
    const element = document.getElementById('exportReportArea');
    html2canvas(element).then(canvas => {
        const link = document.createElement('a');
        link.download = 'گزارش_مالی_' + appData.currentUser + '.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

// EASY BACKUP & RESTORE LOGIC
function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "پشتیبان_مالی_" + (appData.currentUser || 'کاربر') + "_" + getCurrentJalaliDateStr().replace(/\//g, '-') + ".json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function triggerRestore() {
    document.getElementById('restoreFileInput').click();
}

function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && typeof importedData === 'object' && importedData.users) {
                appData = importedData;
                saveLocalData();
                renderAll();
                alert('اطلاعات با موفقیت بازیابی شدند.');
            } else {
                alert('فایل انتخاب‌شده معتبر نیست.');
            }
        } catch (err) {
            alert('خطا در خواندن فایل پشتیبان.');
        }
    };
    reader.readAsText(file);
}

function saveLocalData() {
    localStorage.setItem('finance_app_db_v7', JSON.stringify(appData));
}

function loadLocalData() {
    const data = localStorage.getItem('finance_app_db_v7');
    if (data) {
        try {
            appData = JSON.parse(data);
        } catch (e) {
            console.error(e);
        }
    }
}
