
CREATE   PROCEDURE [PAY].PayPaymentItemReview
(
    @FromCalendarMonthID     INT,
    @CalcTypeIDs             VARCHAR(MAX),
    @SelectedBranches        VARCHAR(MAX) = NULL,
    @SelectedPersonels       VARCHAR(MAX) = NULL,
    @ToCalendarMonthID INT = @FromCalendarMonthID,
    @SelectedCalendarMonth NVARCHAR (MAX) = NULL
)
AS
	DECLARE @Culture       VARCHAR(25),
	        @CultureNo     TINYINT,
	        @Query         NVARCHAR(MAX),
	        @TableName     NVARCHAR(50),
	        @DateFormat     NVARCHAR(10),
	        @DateType       TINYINT,
	        @UserID INT
	
	SET @Culture = CFG.GetuserCulture() 
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	SET @UserID=Cfg.GetuserID()
	
	SET @TableName = cfg.getTempTableName(1)
	
	IF @DateType IS NULL
	SET @DateType = CASE @Culture
	                        WHEN 'fa' THEN 0
	                        WHEN 'en' THEN 1
	                        WHEN 'ar' THEN 2
	                END;
	SELECT @DateFormat = UPPER(us.SettingValue)
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	AND us.UserID = @UserID;
	
	IF @DateFormat IS NULL
	SET @DateFormat = 'YY/MM/DD';
	
	EXEC Pay.spPayPaymentDataSource
	     @FromCalendarMonthID = @FromCalendarMonthID,
	     @CalcTypeIDs = @CalcTypeIDs,
	     @SelectedBranches = @SelectedBranches,
	     @SelectedPersonels = @SelectedPersonels,
	     @TableName = @TableName,
	     @ToCalendarMonthID = @ToCalendarMonthID,
	     @SelectedCalendarMonth = @SelectedCalendarMonth
	     

	SET @Query = 
	    N'
	SELECT T.CalculationResultID,
		case  T.PayType when  0 then N''اعلامیه پرداخت''
		when 1 then N''تسویه''
		when 2 then N''اعلامیه بدهکار بستانکار''
		when 3 then N''تسویه دستی'' end as PayType ,
		T.Number,
		cfg.getclrSaturnDate(T.Date,@DateFormat,0,@DateType) as Date,
		T.PaymentReceiptID,
		T.ManualReceiptID,
		T.CalculationPersonelID,
	case when @CultureNo = 1 then ct.Title
	            when @CultureNo = 2 then ct.Title2
	       end as CalculationType, 
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
	       end as CostCenter,
	       case when @CultureNo = 1 then et.Title
	            when @CultureNo = 2 then et.Title2
	       end as EmploymentType,
	       ISNULL(T.Paid, 0)   AS PayAmount
	FROM   ' + @TableName + 
	    N' T
	       INNER JOIN hrm.Personel  AS p
	            ON  p.PersonelID = T.PersonelID
	       INNER JOIN cfg.Party     AS p2
	            ON  p2.PartyID = p.PartyID
	        INNER JOIN pay.Parameter p3 on t.ParameterID=p3.ParameterID    
	        INNER JOIN pay.CalculationType AS ct
	        ON ct.CalculationTypeID=p3.CalculationTypeID
	        INNER JOIN hrm.EmploymentType     AS et
	            ON  et.EmploymentTypeID=T.EmploymentTypeID
			Inner join Hrm.WorkPlace wp on wp.WorkPlaceID=T.WorkPlaceID
			Inner join cfg.CostCenter cc on cc.CostCenterID=T.CostCenterID
	where (T.CalculationPersonelID is not null or T.PaymentReceiptID is not null or t.DebitCreditID is not Null or T.ManualReceiptID is not null)
			'

EXEC sp_executesql @Query,
     N' @CultureNo TINYINT,
		@DateFormat     NVARCHAR(10),
		@DateType       TINYINT ',
     @CultureNo = @CultureNo,
     @DateFormat=@DateFormat,
     @DateType=@DateType

