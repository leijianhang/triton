const normalize = value => String(value || '').trim().toLowerCase();

export const getSymbolSearchPage = ({
  symbols,
  type,
  query,
  page = 1,
  pageSize = 10
}) => {
  const targetType = ['all', 'stock', 'us', 'hk'].includes(type) ? type : 'stock';
  const keyword = normalize(query);
  const safePageSize = Math.max(1, Number(pageSize) || 10);

  const filtered = symbols.filter(item => {
    const matchesType = targetType === 'all' || item.type === targetType;
    const matchesKeyword = !keyword ||
      normalize(item.symbol).includes(keyword) ||
      normalize(item.name).includes(keyword) ||
      normalize(item.market).includes(keyword) ||
      normalize(item.exchange).includes(keyword) ||
      normalize(item.setup).includes(keyword);

    return matchesType && matchesKeyword;
  });

  const maxPage = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), maxPage);
  const start = (safePage - 1) * safePageSize;

  return {
    items: filtered.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: filtered.length
  };
};
