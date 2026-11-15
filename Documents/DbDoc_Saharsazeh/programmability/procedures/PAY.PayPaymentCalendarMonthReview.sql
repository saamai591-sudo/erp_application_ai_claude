
CREATE   PROCEDURE [PAY].PayPaymentCalendarMonthReview
(@SelectedBranches NVARCHAR(MAX),
    @FromCalendarMonthID     INT,
    @CalcTypeIDs             VARCHAR(MAX),
    @SelectedPersonels       VARCHAR(MAX) = NULL,
    @SelectedItems VARCHAR(MAX) = NULL,
    @ToCalendarMonthID INT = @FromCalendarMonthID
)
AS
	DECLARE @Culture varchar(25),
		    @CultureNo TINYINT,
		    @Query NVARCHAR(MAX),
		    @TableName NVARCHAR(50),
		    @TableName1 NVARCHAR(50)

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	SET @TableName=cfg.getTempTableName(1)
	SET @TableName1=cfg.getTempTableName(1)
	
	EXEC Pay.spPayPaymentDataSource
		@FromCalendarMonthID =@FromCalendarMonthID,
		@CalcTypeIDs =@CalcTypeIDs,
		@SelectedBranches =@SelectedBranches,
		@SelectedPersonels = @SelectedPersonels,
		@TableName =@TableName,
		@ToCalendarMonthID = @ToCalendarMonthID,
		@SelectedCalendarMonth = Null
			
			SET @Query=N' select 
				
				a.CalendarMonthID,
				a.ParameterID,
				sum(a.Amount) Amount,
				sum(a.Paid) Paid
				 into '+@TableName1+N'
	            from '+@TableName+N' a group by
	            a.CalendarMonthID,a.ParameterID'
	
	EXEC (@Query)
	
	SET @Query=N'
	SELECT b.CalendarMonthID,
		   MonthName as MonthTitle,
	         Year as YearTitle,	        
	      case when @CultureNo = 1 then p3.Title
	           when @CultureNo = 2 then p3.Title2
	      end as ParameterTitle,
	      concat(c.Year,''/'',right(concat(''0'',b.MonthNumber),2)) YearMonth,
	       T.Amount,
	       ISNULL(T.Paid, 0)  AS PayAmount,
	       T.Amount -ISNULL(T.Paid, 0) AS RemainAmount
	FROM   '+@TableName1+N' as T
	      Inner Join HRM.CalendarMonth b on t.CalendarMonthID=b.CalendarMonthID
			Inner join Pay.Parameter p3 on T.ParameterID=p3.ParameterID
			Inner join Pay.CalculationType ct on p3.CalculationTypeID=ct.CalculationTypeID
			Inner join hrm.Calendar c on b.CalendarID = c.CalendarID
	          	'
EXEC sp_executesql @Query,
     N'@CultureNo TINYINT',
     @CultureNo = @CultureNo

