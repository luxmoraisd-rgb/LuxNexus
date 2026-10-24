from django.urls import path
from .views import PortfoliosView, PortfolioDetailView

urlpatterns = [
    path("portfolios/", PortfoliosView.as_view(), name="portfolios-list-create"),
    path("portfolios/<str:portfolio_id>/", PortfolioDetailView.as_view(), name="portfolio-detail"),
]
