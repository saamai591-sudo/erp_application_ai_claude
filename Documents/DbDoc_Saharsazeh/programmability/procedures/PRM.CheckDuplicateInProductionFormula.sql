
CREATE   proc PRM.CheckDuplicateInProductionFormula 
(
@ProductionFormulaID int
)

as

declare @Stuffid int,@Columns nvarchar(max),@query nvarchar(max)

select @Stuffid = a.StuffID
from prm.ProductionFormula a
where ProductionFormulaID = @ProductionFormulaID

SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(traceID)
		FROM   stf.Trace 
		FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')

if @Columns is null
set @Columns = '[-1]'

create table #Temp
(
stuffid int
)

set @query = N'
insert into #Temp
select a.stuffid
from prm.ProductionFormula a
left join 
(
select ProductionFormulaID,TraceID,
Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
	 When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
else Value end Value
from prm.ProductionFormulaTrace
)x
pivot
(
max(Value)
for TraceID in ( ' + @Columns + ')
)b
	on a.ProductionFormulaID = b.ProductionFormulaID
where a.stuffid = @Stuffid
group by a.stuffid,' + @Columns + '
having count(1) > 1
'
EXECUTE sp_executeSQL     
		@Query,
		N'@Stuffid int',
		@Stuffid = @Stuffid

if exists
(
select 1 from #Temp
)
RAISERROR(N'ترکیب کالا و ویژگی نمی تواند تکراری باشد.', 16, 12);
