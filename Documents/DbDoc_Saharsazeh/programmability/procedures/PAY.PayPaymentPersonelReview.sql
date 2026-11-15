
CREATE   PROCEDURE [PAY].PayPaymentPersonelReview
(
    @FromCalendarMonthID     INT,
    @CalcTypeIDs             VARCHAR(MAX),
    @SelectedBranches        VARCHAR(MAX) = NULL,
    @SelectedItems           VARCHAR(MAX) = NULL,
    @ToCalendarMonthID INT = @FromCalendarMonthID,
    @SelectedCalendarMonth NVARCHAR(MAX) = NULL
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
	     @FromCalendarMonthID = @FromCalendarMonthID,
	     @CalcTypeIDs = @CalcTypeIDs,
	     @SelectedBranches = @SelectedBranches,
	     @SelectedPersonels = Null,
	     @TableName = @TableName,
	     @ToCalendarMonthID = @ToCalendarMonthID,
	     @SelectedCalendarMonth = @SelectedCalendarMonth
			
	SET @Query=N' select 
				a.EmploymentTypeID,
				a.WorkPlaceID,
				a.CostCenterID,
				a.PersonelID,
				a.ParameterID,
				sum(a.Amount) Amount,
				sum(a.Paid) Paid
				 into '+@TableName1+N'
	            from '+@TableName+N' a group by
	            a.EmploymentTypeID,
				a.WorkPlaceID,
				a.CostCenterID,
				a.PersonelID,
				a.ParameterID'
	
	EXEC (@Query)
	
	SET @Query=N'
	SELECT 
	cast(ct.CalculationTypeID as nvarchar(20))+''-''+cast(T.PersonelID as varchar(20)) PersonelID,
	       p.Code                   AS PersonelCode,
		   case when @CultureNo = 1 then p2.Title
	           when @CultureNo = 2 then p2.Title2
	      end as PersonelName, 
		   case when @CultureNo = 1 then p2.LastName
	           when @CultureNo = 2 then p2.LastName2
	      end as LastName, 
	      case when @CultureNo = 1 then wp.Title
	           when @CultureNo = 2 then wp.Title2
	      end as WorkPlace,
	      case when @CultureNo = 1 then cc.Title
	           when @CultureNo = 2 then cc.Title2
	       end CostCenter,
	      case when @CultureNo = 1 then et.Title
	           when @CultureNo = 2 then et.Title2 end EmploymentType,
	       case when @CultureNo = 1 then ct.Title
	           when @CultureNo = 2 then ct.Title2 end CalculationType,    
	       T.Amount,
	       ISNULL(T.Paid, 0)   AS PayAmount,
	       T.Amount -ISNULL(T.Paid, 0) AS RemainAmount
	FROM   '+@TableName1+N' as T
	       INNER JOIN hrm.Personel  AS p
	            ON  p.PersonelID = T.PersonelID
	       INNER JOIN cfg.Party     AS p2
	            ON  p2.PartyID = p.PartyID
	       INNER JOIN hrm.EmploymentType     AS et
	            ON  et.EmploymentTypeID=T.EmploymentTypeID
			Inner join Hrm.WorkPlace wp on wp.WorkPlaceID=T.WorkPlaceID
			Inner join cfg.CostCenter cc on cc.CostCenterID=T.CostCenterID
			Inner join Pay.Parameter p3 on T.ParameterID=p3.ParameterID
			Inner join Pay.CalculationType ct on p3.CalculationTypeID=ct.CalculationTypeID
	          	'
EXEC sp_executesql @Query,
     N'@CultureNo TINYINT',
     @CultureNo = @CultureNo

