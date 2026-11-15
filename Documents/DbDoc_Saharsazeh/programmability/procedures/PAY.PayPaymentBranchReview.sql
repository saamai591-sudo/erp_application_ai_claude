
CREATE   PROCEDURE [PAY].PayPaymentBranchReview
(
    @FromCalendarMonthID     INT,
    @CalcTypeIDs             VARCHAR(MAX),
    @SelectedPersonels       VARCHAR(MAX) = NULL,
    @SelectedItems VARCHAR(MAX) = NULL,
    @ToCalendarMonthID INT = @FromCalendarMonthID,
    @SelectedCalendarMonth NVARCHAR(MAX) = Null
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
		@SelectedBranches =NULL,
		@SelectedPersonels = @SelectedPersonels,
		@TableName =@TableName,
		@ToCalendarMonthID = @ToCalendarMonthID,
		@SelectedCalendarMonth = @SelectedCalendarMonth
			
			SET @Query=N' select 
				
				a.BranchID,
				a.ParameterID,
				sum(a.Amount) Amount,
				sum(a.Paid) Paid
				 into '+@TableName1+N'
	            from '+@TableName+N' a group by
	            a.BranchID,a.ParameterID'
	
	EXEC (@Query)
	
	SET @Query=N'
	SELECT b.BranchID,
	       b.Code                  AS BranchCode,
		   case when @CultureNo = 1 then b.Title
	           when @CultureNo = 2 then b.Title2
	      end as BranchTitle,  
	       T.Amount,
	       ISNULL(T.Paid, 0)  AS PayAmount,
	       T.Amount -ISNULL(T.Paid, 0) AS RemainAmount
	FROM   '+@TableName1+N' as T
	      Inner Join cfg.Branch b on t.BranchID=b.BranchID
			Inner join Pay.Parameter p3 on T.ParameterID=p3.ParameterID
			Inner join Pay.CalculationType ct on p3.CalculationTypeID=ct.CalculationTypeID
	          	'
EXEC sp_executesql @Query,
     N'@CultureNo TINYINT',
     @CultureNo = @CultureNo

