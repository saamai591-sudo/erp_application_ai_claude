
CREATE   FUNCTION [STF].[GetTraceOfInputID]()
RETURNS int
BEGIN
declare @TraceID int

select @TraceID = TraceID
from STF.Trace
where Title = 'Input ID'

RETURN @TraceID
END

