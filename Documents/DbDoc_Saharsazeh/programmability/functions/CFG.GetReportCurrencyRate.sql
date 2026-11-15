
CREATE   FUNCTION CFG.GetReportCurrencyRate
(
@Date date
)
RETURNS decimal(30,4)
BEGIN
DECLARE @ReportCurrencyRate decimal(30,4);
DECLARE @ReportCurrencyID int

select @ReportCurrencyID = ConfigValue
from noc.NIOCSetting where ConfigKey = 'CurrencyReport'

if @ReportCurrencyID is null
	RETURN null

select top 1 @ReportCurrencyRate = rate
from CFG.CurrencyRate
where CurrencyID = @ReportCurrencyID
and Date <= @Date
order by Date desc


RETURN @ReportCurrencyRate
END
