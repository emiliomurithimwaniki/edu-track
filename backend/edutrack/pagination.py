from rest_framework.pagination import PageNumberPagination


class CustomPageNumberPagination(PageNumberPagination):
    """Allow clients to control page size with a sensible upper bound.

    Defaults to 50 to keep responses small, but accepts a `page_size` query
    param up to 2000 so admin pages can load full lists when needed.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 2000
