import { TrendingUp, DollarSign, BarChart3, Target } from 'lucide-react'

const Yearly = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary leading-tight mb-4">
          Yearly Overview
        </h1>
        <p className="text-text-secondary text-lg">
          Annual performance analysis and strategic insights
        </p>
      </div>

      {/* Yearly Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Annual Turnover</p>
              <p className="text-3xl font-bold text-text-primary">R 14.2M</p>
              <p className="text-status-success text-sm flex items-center mt-1">
                <TrendingUp size={16} className="mr-1" />
                +24.8%
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-primary rounded-lg flex items-center justify-center">
              <DollarSign className="text-text-primary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Avg Monthly</p>
              <p className="text-3xl font-bold text-text-primary">R 1.18M</p>
              <p className="text-status-success text-sm flex items-center mt-1">
                <TrendingUp size={16} className="mr-1" />
                +8.9%
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-secondary-blue rounded-lg flex items-center justify-center">
              <BarChart3 className="text-text-primary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Total Transactions</p>
              <p className="text-3xl font-bold text-text-primary">412,567</p>
              <p className="text-status-success text-sm flex items-center mt-1">
                <TrendingUp size={16} className="mr-1" />
                +15.3%
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
              <Target className="text-text-primary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Annual GP</p>
              <p className="text-3xl font-bold text-text-primary">R 3.9M</p>
              <p className="text-status-success text-sm flex items-center mt-1">
                <TrendingUp size={16} className="mr-1" />
                +28.5%
              </p>
            </div>
            <div className="w-12 h-12 bg-chart-gold rounded-lg flex items-center justify-center">
              <DollarSign className="text-text-primary" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-2xl font-semibold text-text-primary mb-4">Annual Turnover Trend</h2>
            <div className="h-80 bg-surface-secondary/50 rounded-xl p-4 flex items-center justify-center">
              <p className="text-text-secondary">Yearly chart component will be added here</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Year Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Best Month</span>
                <span className="text-text-primary font-medium">December</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Best Month Value</span>
                <span className="text-text-primary font-medium">R 1.45M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Worst Month</span>
                <span className="text-text-primary font-medium">January</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-text-primary font-semibold">GP %</span>
                  <span className="text-accent-primary font-bold text-lg">27.4%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Annual Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">vs Last Year</span>
                <span className="text-status-success font-medium">+24.8%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">vs Target</span>
                <span className="text-status-success font-medium">+18.5%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Growth Rate</span>
                <span className="text-text-primary font-medium">24.8%</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Forecast</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Next Year Target</span>
                <span className="text-text-primary font-medium">R 17.5M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Growth Needed</span>
                <span className="text-accent-primary font-medium">23.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Yearly 