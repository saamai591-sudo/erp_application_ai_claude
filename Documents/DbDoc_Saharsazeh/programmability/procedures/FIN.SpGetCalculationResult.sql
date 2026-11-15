---------------------------------------------------------------------------------------------

CREATE    PROC   [FIN].SpGetCalculationResult
(
@Branch int,
@CalendarMonth int,
@CalculaionType int
)
as
--with encryption

declare @UserID INT,@DateType TINYINT,@DateFormat VARCHAR(10);
SET @UserID = CFG.GetuserID()

declare @Culture NVARCHAR(100),
@CultureNo tinyint

SET @Culture = cfg.GetuserCulture()

select @CultureNo = CultureNo
from CFG.CultureInfo
where Culture = @Culture


SELECT  @DateType = us.SettingValue
FROM    CFG.UserSetting us
WHERE   us.SettingKey = 'Date_Type'
AND us.UserID = @UserID

IF @DateType IS NULL
SET @DateType = CASE @Culture
WHEN 'fa' THEN 0
WHEN 'en' THEN 1
WHEN 'ar' THEN 2
END

SELECT  @DateFormat = us.SettingValue
FROM    CFG.UserSetting us
WHERE   us.SettingKey = 'Date_Format'
AND us.UserID = @UserID

IF @DateFormat IS NULL
SET @DateFormat = 'YY/MM/DD'



declare @ParameterID int =
(select Top 1 ParameterID
from pay.Parameter
where SystemName = 'Khales'
and CalculationTypeID = @CalculaionType)




declare @ConfigValue varchar(25) = (
select ConfigValue
from cfg.Configuration
where ConfigKey = 'AgreementNeedConfirm'
)

declare @EndDate date = (select enddate
from hrm.CalendarMonth
where CalendarMonthID = @CalendarMonth
)

/*آخرین حکم افراد در ماه مورد نظر*/
select *
into #agreement
from (
select ROW_NUMBER() over(partition by PersonelID
order by case when LOWER(@ConfigValue) = 'false'
then issuedate
else confirmdate end desc) Rno,
PersonelID,
CostCenterID,
EmploymentTypeID,
WorkPlaceID,
a.BranchID
from hrm.agreement a
where (LOWER(@ConfigValue) = 'false' or ConfirmedBy is not null)
and  (case when LOWER(@ConfigValue) = 'false'
then issuedate
else confirmdate end ) <= @EndDate
)A
where Rno = 1
and a.BranchID = @Branch


declare @Columns nvarchar(max),
@ColumnsInSelect nvarchar(max),
@Query   nvarchar(max),
@Param   nvarchar(max)

SELECT @Columns = STUFF((SELECT  ','+QUOTENAME(DlTypeID)
FROM   pay.PayrollDlType
FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')

if @Columns is null
set @Columns = '[-1]'

SELECT @ColumnsInSelect = STUFF((SELECT  ','+QUOTENAME(DlTypeID)+' T' +cast(DlTypeID as nvarchar(150))
FROM   pay.PayrollDlType
FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,0,'')

if(@ColumnsInSelect is null)
set @ColumnsInSelect = ''

set @Query = N'select cr.CalculationResultID,
et.Title EmploymentType,
pa.DlID,
p.Code PersonelCode,
case when '+ CAST(@CultureNo AS CHAR(1)) +' = 1 then
pa.Title + '' '' + ISNULL(pa.LastName,'''')
when '+ CAST(@CultureNo AS CHAR(1)) +' = 2 then
pa.Title2 + '' '' + ISNULL(pa.LastName2,'''')
end as PersonelTitle,
case when '+ CAST(@CultureNo AS CHAR(1)) +' = 1 then cc.Title
when '+ CAST(@CultureNo AS CHAR(1)) +' = 2 then cc.Title2
end as CostCenter,
case when '+ CAST(@CultureNo AS CHAR(1)) +' = 1 then wp.Title
when '+ CAST(@CultureNo AS CHAR(1)) +' = 2 then wp.Title2
end as WorkPlace,
cr.Value NetPay,
CalculationResult.Remain  NetPayRemain
'+@ColumnsInSelect+'
from PAY.CalculationResult cr
join pay.CalculationPersonel cp on cr.CalculationPersonelID=cp.CalculationPersonelID
join #agreement a on a.PersonelID = cp.PersonelID
join HRM.Personel p on p.PersonelID = a.PersonelID
join CFG.Party pa on pa.PartyID = p.PartyID
join HRM.EmploymentType et on et.EmploymentTypeID = a.EmploymentTypeID
join CFG.CostCenter cc on cc.CostCenterID = a.CostCenterID
join HRM.WorkPlace wp on wp.WorkPlaceID = a.WorkPlaceID
left join
(select PersonelID,DlTypeID,DlID
from pay.PersonelVoucherSetting pvs
join pay.PersonelVoucherSettingDl pvsd on pvs.PersonelVoucherSettingID = pvsd.PersonelVoucherSettingID
)x
pivot
(
max(dlid)
for DlTypeID in ('+@Columns+')
)piv on piv.PersonelID = a.PersonelID
left join
[PAY].[CalculationResult_NonPayment] CalculationResult
on CalculationResult.CalculationResultID = cr.CalculationResultID
where cp.CalendarMonthID = @pCalendarMonthID
and cp.CalculationTypeID=@pCalculationTypeID
and CalculationResult.Remain>0
and cr.ParameterID = @pParameterID'

SET @Param = N'@pCalculationTypeID INT,@pCalendarMonthID INT,@pParameterID INT'
print @Query
EXECUTE sp_executeSQL
@Query,
@Param,
@pCalculationTypeID = @CalculaionType,
@pCalendarMonthID =  @CalendarMonth ,
@pParameterID =  @ParameterID
