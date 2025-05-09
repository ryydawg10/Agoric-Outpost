

const ctx = document.getElementById('chart1').getContext('2d');
        const chart1 = new Chart(ctx, {
            type: 'bar', // Change this to the type of chart you need
            data: {
                labels: ['0', '1', '2', '3', '4', '5', '6','7','8','9','10','11','12','13','14'],
                datasets: [{
                    label: 'Delegations',
                    data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    backgroundColor: [
                        'rgb(215, 50, 82)',
                    ],
                    borderColor: [
                        'rgb(215, 50, 82, .5)',
                    ],
                    borderWidth: 1,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,  // Ensures chart adapts to container
                maintainAspectRatio: false, // Allow chart to scale freely
                scales: {
                    y: {
                        beginAtZero: false,
                    },
                    x: {
                        ticks: {
                                display: false // This hides the x-axis labels
                            }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                          label: function(context) {
                            // Get the label and value
                            let label = context.dataset.label || '';
                            let value = context.raw;
                  
                            // Add space if label exists
                            if (label) {
                              label += ': ';
                            }
                  
                            return label + value + ' BLD';
                          }
                        }
                      }
                    }
                  }
                }
            
        );

const ctx2 = document.getElementById('chart2').getContext('2d');
        const chart2 = new Chart(ctx2, {
            type: 'bar', // Change this to the type of chart you need
            data: {
                labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
                datasets: [{
                    label: 'Rewards',
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: [
                       'rgb(215, 50, 82)',
                    ],
                    borderColor: [
                        'rgb(215, 50, 82, .5)',
                    ],
                    borderWidth: 1,
                    tension: 0.4,
                }]
            },
            options: {
                  responsive: true,  // Ensures chart adapts to container
                  maintainAspectRatio: false, // Allow chart to scale freely
                  scales: {
                      y: {
                          position: 'left',
                          beginAtZero: false
                      },
                      x: {
                          ticks: {
                                  display: false // This hides the x-axis labels
                              }
                      }
                      
                  },
                  plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                          label: function(context) {
                            // Get the label and value
                            let label = context.dataset.label || '';
                            let value = context.raw;
                  
                            // Add space if label exists
                            if (label) {
                              label += ': ';
                            }
                  
                            return label + value + ' BLD';
                          }
                        }
                      }
                    }
                  }
                }
              
        );

const ctx3 = document.getElementById('chart3').getContext('2d');
    const chart3 = new Chart(ctx3, {
        data: {
            labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
            datasets: [{
                type: 'line',
                data: [12, 19, 3, 5, 2, 3],
                backgroundColor: [
                   'rgb(215, 50, 82)',
                ],
                borderColor: [
                   'rgb(215, 50, 82, .5)',
                ],
                borderWidth: 1,
                tension: 0.4,
            },
            {
                type: 'bar',
                data: [0,0,0,0,0,0],
                backgroundColor: ['rgb(215, 50, 82)',],
                borderColor: ['rgb(215, 50, 82, .5)',],
                borderWidth: 1,
            }
            ]
            
        },
        options: {
              responsive: true,  // Ensures chart adapts to container
              maintainAspectRatio: false, // Allow chart to scale freely
              scales: {
                  y: {
                      position : 'right',
                      beginAtZero: true,
                  },
                  x: {
                    ticks: {
                            display: false // This hides the x-axis labels
                        }
                }
              },
              plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    display: true,
                    color: 'rgb(215, 50, 82)',
                    font: {
                        weight: 'bold'
                    },
                    formatter: function(value){
                        return value;
                    },
                    anchor: 'end',
                    align: 'top',
                  },
                tooltip: {
                    callbacks: {
                      label: function(context) {
                        // Get the label and value
                        let label = context.dataset.label || '';
                        let value = context.raw;
              
                        // Add space if label exists
                        if (label) {
                          label += ': ';
                        }
              
                        return label + value + ' Tx';
                      }
                    }
                  },
                }
              },
              plugins: [ChartDataLabels]
            }
            
          
    );

const ctx4 = document.getElementById('chart4').getContext('2d');
    const chart4 = new Chart(ctx4, {
        type: 'line', 
        data: {
            labels: ['0', '1', '2', '3', '4', '5', '6','7','8','9','10','11','12','13','14'],
            datasets: [{
                label: 'Sends',
                data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                backgroundColor: [
                    'rgb(215, 50, 82)',
                ],
                borderColor: [
                    'rgb(215, 50, 82, .5)',
                ],
                borderWidth: 1,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,  // Ensures chart adapts to container
            maintainAspectRatio: false, // Allow chart to scale freely
            scales: {
                y: {
                    position: 'right',
                    beginAtZero: false,
                },
                x: {
                    ticks: {
                            display: false, // This hides the x-axis labels
                        }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                      label: function(context) {
                        // Get the label and value
                        let label = context.dataset.label || '';
                        let value = context.raw;
              
                        // Add space if label exists
                        if (label) {
                          label += ': ';
                        }
              
                        return label + value + ' BLD';
                      }
                    }
                  }
                }
              }
            }
        
    );

    
let currInt = 5;
let currTimeFrame = '4hr';
let abortController = null;
let startTime = 0;
let endTime = null;
let currLength = 24;
let difference = 0;

document.addEventListener('DOMContentLoaded', async function() {
    Load('4hr',24);
    document.getElementById('4hr').addEventListener('click', async function() {
        Load('4hr',24);
    });
    document.getElementById('1day').addEventListener('click', async function() {
        Load('1day',24);
    });
    document.getElementById('4day').addEventListener('click', async function() {
        Load('4day',24);
    });
    document.getElementById('8day').addEventListener('click', async function() {
        Load('8day',24);
    });
    document.getElementById('15day').addEventListener('click', async function() {
        Load('15day',15);
    });
    document.getElementById('1month').addEventListener('click', async function() {
        Load('1month',28);
    });
    document.getElementById('4hr').classList.add('selected');


    document.getElementById('5min').addEventListener('click', async function() {
        autoRefresh(5);
    });
    document.getElementById('15min').addEventListener('click', async function() {
        autoRefresh(15);
    });
    document.getElementById('30min').addEventListener('click', async function() {
        autoRefresh(30);
    });

    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('dropdown-menu').classList.toggle('hidden');
        document.getElementById('line').classList.toggle('hidden');
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth >= 800) {
          document.getElementById('dropdown-menu').classList.add('hidden');
          document.getElementById('line').classList.add('hidden');
        }
      });
      
    autoRefresh(5);
});


    
    
async function Load(timeFrame, length) {
    try {
        currTimeFrame = timeFrame;
        currLength = length;
        const buttons = document.querySelectorAll('.timeframe-buttons');
        buttons.forEach(btn => {
            btn.classList.remove('selected');
            if (btn.id === timeFrame) {
                btn.classList.add('selected');
            }
        });
    
        let data = 0;
        const response = await fetch('/api/' + timeFrame + '/fullLoad');
        const jsonData = await response.json();

        // Clear previous data before updating the chart
        chart1.data.datasets[0].data = [];
        chart1.data.labels = [];
        chart2.data.datasets[0].data = [];
        chart2.data.labels = [];
        chart3.data.datasets[0].data = [];
        chart3.data.datasets[1].data = [];
        chart3.data.labels = [];
        chart4.data.datasets[0].data = [];
        chart4.data.labels = [];

        if(timeFrame == '4hr')
        {
            data = jsonData.fourHrData;
        }
        else if(timeFrame == '1day')
        {
            data = jsonData.formattedOneDayData;
        }
        else if(timeFrame == '4day')
        {
            data = jsonData.formattedFourDayData;
        }
        else if(timeFrame == '8day')
        {
            data = jsonData.formattedEightDayData;
        }
        else if(timeFrame == '15day')
        {
            data = jsonData.formattedFifteenDayData;
        }
        else if(timeFrame == '1month')
        {
            data = jsonData.formattedOneMonthData;
        }
        // Correctly accessing the nested data inside data\
        
        const sendsData = data.sends;
        const delData = data.delegations;
        const successFailData = data.successFail;
        const rewardsData = data.rewards;
        const dataLength = data.sends.length;
        for (let i = 0; i<length; i++) {
            let index = dataLength-i-1;
            if(index>=0)
            {
            chart4.data.datasets[0].data[i] = sendsData[index].value;
            chart4.data.labels[i] = sendsData[index].timeStamp;
            chart1.data.datasets[0].data[i] = delData[index].value;
            chart1.data.labels[i] = delData[index].timeStamp;
            chart3.data.datasets[0].data[i] = successFailData[index].success;
            chart3.data.datasets[1].data[i] = successFailData[index].fail;
            chart3.data.labels[i] = successFailData[index].timeStamp;
            chart2.data.datasets[0].data[i] = rewardsData[index].value;
            chart2.data.labels[i] = rewardsData[index].timeStamp;
            }
            else{
                chart4.data.datasets[0].data[i] = 0;
                chart4.data.labels[i] = 0;
                chart1.data.datasets[0].data[i] = 0;
                chart1.data.labels[i] = 0;
                chart3.data.datasets[0].data[i] = 0;
                chart3.data.datasets[1].data[i] = 0;
                chart3.data.labels[i] = 0;
                chart2.data.datasets[0].data[i] = 0;
                chart2.data.labels[i] = 0;
            }
        }
        chart1.update();
        chart4.update();  // Ensure the chart is updated after data assignment
        chart3.update();
        chart2.update();
        console.log("Chart updated successfully!");
        const timestampEl = document.getElementById("timestamp");


        const now = new Date();
        const formatted = now.toLocaleString(); // or toLocaleTimeString(), depending on your needs


        timestampEl.textContent = "Last Updated: " + formatted + " PST";
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

async function autoRefresh(interval)
{
    console.log(interval + "refresh")
    formattedInt = interval + "min";
    const buttons = document.querySelectorAll('.interval-buttons');
    buttons.forEach(btn => {
        btn.classList.remove('selected');
        if (btn.id === formattedInt) {
            btn.classList.add('selected');
        }
    });

    if (abortController) {
        abortController.abort();
    }
    currInt = interval;
    abortController = new AbortController();
    let signal = abortController.signal;
    autoUpdate(signal)

}

async function autoUpdate(signal)
{   
    difference = 0;

    signal.addEventListener('abort', () => {
        console.log("prep triggered before exiting");
        endTime = Date.now();
    });

    while (true)
    {
        if (endTime)
        {
            difference = endTime - startTime;
            endTime = null;
        }

        startTime = Date.now();
        difference = 0;
        try {
            await wait(currInt * 60 * 1000 - difference, signal);
        } catch (err) {
            if (err.name === "AbortError") {
                console.log("wait aborted");
                break; // exit the loop cleanly
            } else {
                throw err; // rethrow unexpected errors
            }
        }

        await Load(currTimeFrame, currLength);
        console.log("refreshed" + currInt);
    }
}
function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException("Aborted", "AbortError"));
        });
    });
}