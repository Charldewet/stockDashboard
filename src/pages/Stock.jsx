import { TrendingUp, Package, AlertTriangle, TrendingDown } from 'lucide-react'

const Stock = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary leading-tight mb-1">
          Stock Management
        </h1>
        <p className="text-xs text-text-secondary mb-3">
          {selectedDate?.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stock Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Opening Stock</p>
              <p className="text-3xl font-bold text-text-primary">R 2.45M</p>
              <p className="text-status-success text-sm flex items-center mt-1">
                <TrendingUp size={16} className="mr-1" />
                +5.2%
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-primary rounded-lg flex items-center justify-center">
              <Package className="text-text-primary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Closing Stock</p>
              <p className="text-3xl font-bold text-text-primary">R 2.38M</p>
              <p className="text-status-warning text-sm flex items-center mt-1">
                <TrendingDown size={16} className="mr-1" />
                -2.8%
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-secondary-blue rounded-lg flex items-center justify-center">
              <Package className="text-text-primary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Turnover Ratio</p>
              <p className="text-3xl font-bold text-text-primary">5.8</p>
              <p className="text-status-success text-sm flex items-center mt-1">
                <TrendingUp size={16} className="mr-1" />
                +0.3
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
              <TrendingUp className="text-text-primary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Days of Inventory</p>
              <p className="text-3xl font-bold text-text-primary">63</p>
              <p className="text-status-success text-sm flex items-center mt-1">
                <TrendingDown size={16} className="mr-1" />
                -2 days
              </p>
            </div>
            <div className="w-12 h-12 bg-chart-gold rounded-lg flex items-center justify-center">
              <AlertTriangle className="text-text-primary" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-2xl font-semibold text-text-primary mb-4">Stock Level Trends</h2>
            <div className="h-80 bg-surface-secondary/50 rounded-xl p-4 flex items-center justify-center">
              <p className="text-text-secondary">Stock chart component will be added here</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Stock Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Stock Purchases</span>
                <span className="text-text-primary font-medium">R 1.2M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Stock Adjustments</span>
                <span className="text-text-primary font-medium">R 45,230</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Cost of Sales</span>
                <span className="text-text-primary font-medium">R 1.15M</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-text-primary font-semibold">Net Change</span>
                  <span className="text-status-error font-bold text-lg">-R 70,000</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Stock Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Turnover Efficiency</span>
                <span className="text-status-success font-medium">Good</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Stock Aging</span>
                <span className="text-status-warning font-medium">63 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Stock Value</span>
                <span className="text-text-primary font-medium">R 2.38M</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Alerts</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-status-warning/10 rounded-lg border border-status-warning/20">
                <AlertTriangle size={16} className="text-status-warning" />
                <span className="text-text-secondary text-sm">5 items low on stock</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-status-error/10 rounded-lg border border-status-error/20">
                <AlertTriangle size={16} className="text-status-error" />
                <span className="text-text-secondary text-sm">2 items out of stock</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Stock 