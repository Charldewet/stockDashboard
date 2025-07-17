from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
from sqlalchemy import UniqueConstraint, Index

db = SQLAlchemy()

class Department(db.Model):
    __tablename__ = 'departments'
    
    department_code = db.Column(db.String(10), primary_key=True)
    department_name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    products = db.relationship('Product', backref='department', lazy=True)
    
    def to_dict(self):
        return {
            'department_code': self.department_code,
            'department_name': self.department_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    stock_code = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    department_code = db.Column(db.String(10), db.ForeignKey('departments.department_code'), nullable=False)
    pharmacy_id = db.Column(db.String(10), default='REITZ', nullable=False)
    first_seen_date = db.Column(db.Date, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint for stock_code + pharmacy_id
    __table_args__ = (
        UniqueConstraint('stock_code', 'pharmacy_id', name='uq_product_pharmacy'),
        Index('idx_stock_code', 'stock_code'),
        Index('idx_pharmacy_id', 'pharmacy_id'),
    )
    
    # Relationships
    sales_history = db.relationship('SalesHistory', backref='product', lazy=True, cascade='all, delete-orphan')
    daily_sales = db.relationship('DailySales', backref='product', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'stock_code': self.stock_code,
            'description': self.description,
            'department_code': self.department_code,
            'pharmacy_id': self.pharmacy_id,
            'first_seen_date': self.first_seen_date.isoformat() if self.first_seen_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class SalesHistory(db.Model):
    __tablename__ = 'sales_history'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    total_quantity_sold = db.Column(db.Numeric(10, 2), default=0.0)
    avg_monthly_sales = db.Column(db.Numeric(10, 2), default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint for product + year + month
    __table_args__ = (
        UniqueConstraint('product_id', 'year', 'month', name='uq_product_month'),
        Index('idx_year_month', 'year', 'month'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'year': self.year,
            'month': self.month,
            'total_quantity_sold': float(self.total_quantity_sold) if self.total_quantity_sold else 0.0,
            'avg_monthly_sales': float(self.avg_monthly_sales) if self.avg_monthly_sales else 0.0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DailySales(db.Model):
    __tablename__ = 'daily_sales'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    sale_date = db.Column(db.Date, nullable=False)
    on_hand = db.Column(db.Numeric(10, 2), default=0.0)
    sales_qty = db.Column(db.Numeric(10, 2), default=0.0)
    sales_value = db.Column(db.Numeric(10, 2), default=0.0)
    sales_cost = db.Column(db.Numeric(10, 2), default=0.0)
    gross_profit = db.Column(db.Numeric(10, 2), default=0.0)
    turnover_percent = db.Column(db.Numeric(5, 2), default=0.0)
    gross_profit_percent = db.Column(db.Numeric(5, 2), default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint for product + sale_date
    __table_args__ = (
        UniqueConstraint('product_id', 'sale_date', name='uq_product_date'),
        Index('idx_sale_date', 'sale_date'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'sale_date': self.sale_date.isoformat() if self.sale_date else None,
            'on_hand': float(self.on_hand) if self.on_hand else 0.0,
            'sales_qty': float(self.sales_qty) if self.sales_qty else 0.0,
            'sales_value': float(self.sales_value) if self.sales_value else 0.0,
            'sales_cost': float(self.sales_cost) if self.sales_cost else 0.0,
            'gross_profit': float(self.gross_profit) if self.gross_profit else 0.0,
            'turnover_percent': float(self.turnover_percent) if self.turnover_percent else 0.0,
            'gross_profit_percent': float(self.gross_profit_percent) if self.gross_profit_percent else 0.0,
            'created_at': self.created_at.isoformat() if self.created_at else None
        } 