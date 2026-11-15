
CREATE   proc [STF].[FindStuffPropertyValue]
(
@stuffId int ,
@groupId int,
@stuffNature TinyInt
)
as
declare 
		@Culture   VARCHAR(10),
		@CultureNo VARCHAR(10),
		@UserID    INT

SET @UserID = cfg.GetuserID();
SET @Culture = CFG.GetuserCulture();

select @CultureNo = CultureNo
from cfg.CultureInfo
where Culture = @Culture

select 
	isnull(StuffId ,@stuffId) StuffId ,
	a.PropertyId  ,
	isnull(StuffPropertyValueId,0) StuffPropertyValueId,
	isnull(b.CreationDate,getdate()) CreationDate,
	isnull(b.Creator,@UserID) Creator ,
	isnull(b.Version,0) Version,
	case when b.TraceItemID is not null then ti.Item else b.Value end Value ,
	case when b.TraceItemID is not null then ti.Item2 else b.Value2 end Value2 ,
	b.TraceItemId ,
	c.title  PropertyTitle ,
	c.title2 PropertyTitle2 ,
	a.IsMandetory IsRequired ,
	cast(c.AccountLevelTypeId as int) FieldType ,
	a.TraceListTypeId ,
	a.RowIndex ,
	ApplyPropertyValueInStandard ,
	ApplyTitleInStandard ,
	case when b.TraceItemID is not null then ti.Code  end TraceItemCode,
	c.IncludeInCommodityCode
from stf.StuffGroupProperty a
left join stf.StuffPropertyValue b
	on b.StuffID = @stuffId and a.PropertyID = b.PropertyID
join stf.Property c
	on a.PropertyID = c.PropertyID
left join stf.TraceItem ti
	on ti.TraceItemID = b.TraceItemID
where StuffGroupID = @groupId
order by a.RowIndex
