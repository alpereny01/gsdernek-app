document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    // Gradient for Income
    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 400);
    incomeGradient.addColorStop(0, 'rgba(255, 182, 18, 0.8)');
    incomeGradient.addColorStop(1, 'rgba(255, 182, 18, 0.1)');

    // Gradient for Expense
    const expenseGradient = ctx.createLinearGradient(0, 0, 0, 400);
    expenseGradient.addColorStop(0, 'rgba(138, 3, 4, 0.8)');
    expenseGradient.addColorStop(1, 'rgba(138, 3, 4, 0.1)');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Aralık', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs'],
            datasets: [
                {
                    label: 'Gelir',
                    data: [9500, 10200, 11500, 10800, 12100, 12450],
                    backgroundColor: incomeGradient,
                    borderColor: '#FFB612',
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Gider',
                    data: [7800, 8100, 7500, 8400, 7900, 8320],
                    backgroundColor: expenseGradient,
                    borderColor: '#8A0304',
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: '#A0A0A0',
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 30, 30, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#A0A0A0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666666',
                        callback: function(value) {
                            return '€' + value / 1000 + 'k';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#A0A0A0'
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            }
        }
    });
});
