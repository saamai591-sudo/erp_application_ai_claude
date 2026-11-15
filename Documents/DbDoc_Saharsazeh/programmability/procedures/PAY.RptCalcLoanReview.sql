	
------------Start of #8147
CREATE     PROCEDURE [PAY].RptCalcLoanReview
    (
      @FromCalendarMonthId INT ,
      @ToCalendarMonthId INT ,
      @SelectedPersonnel VARCHAR(MAX) = NULL ,
      @SelectedParameterID VARCHAR(MAX) = NULL
    )

--WITH ENCRYPTION
AS
    DECLARE @EndDate DATE,@Culture varchar(25),
		@CultureNo TINYINT,@StartDate DATE

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	
    SELECT  @EndDate = cm.EndDate
    FROM    HRM.CalendarMonth cm
    WHERE   cm.CalendarMonthID = @ToCalendarMonthId;
    
	SELECT @StartDate = cm.StartDate
    FROM    HRM.CalendarMonth cm
    WHERE   cm.CalendarMonthID = @FromCalendarMonthId;
    
    CREATE TABLE #SelPersonel ( PersonelID INT );
	
    IF @SelectedPersonnel IS NOT NULL
        BEGIN
            INSERT  INTO #SelPersonel
                    SELECT  value
                    FROM    CFG.R_FnCommaStr2Table(@SelectedPersonnel) rfcst;
	    
            CREATE TABLE #ValidPersonel ( personelId INT );
	    
	    
            INSERT  INTO #ValidPersonel
                    EXEC HRM.GetValidPersonelWithBranchAccess @EndDate;
	    
            DELETE  #SelPersonel
            WHERE   PersonelID NOT IN ( SELECT  personelId
                                        FROM    #ValidPersonel );
        END;
    ELSE
        INSERT  INTO #SelPersonel
                EXEC HRM.GetValidPersonelWithBranchAccess @EndDate;
	
    SELECT  value
    INTO    #selParameter
    FROM    CFG.R_FnCommaStr2Table(@SelectedParameterID) rfcst;
	
    SELECT  LoanID ,
            BaseParentID ,
            ParameterID ,
            T.PersonelID ,
            T.TotalAmount ,
            T.ParentID ,
            T.CalendarMonthID ,
            T.Number ,
            T.Date ,
            InstallmentCount ,
            T.FacilitiesNumber,
			T.RoundPayment,
			T.TotalRound,
			T.InstallmentAmount
    INTO    #loan
    FROM    ( SELECT    PAY.Loan.* ,
                        ROW_NUMBER() OVER ( PARTITION BY PAY.Loan.BaseParentID ORDER BY cm.StartDate ) AS Rno
              FROM      PAY.Loan
                        INNER JOIN HRM.CalendarMonth cm ON cm.CalendarMonthID = PAY.Loan.CalendarMonthID
                        INNER JOIN #SelPersonel ON #SelPersonel.PersonelID = PAY.Loan.PersonelID
              WHERE     cm.EndDate <= @EndDate
                        AND ( @SelectedParameterID IS NULL
                              OR PAY.Loan.ParameterID IN ( SELECT
                                                              value
                                                           FROM
                                                              #selParameter )
                            )
            ) T
    WHERE   T.Rno = 1;

    DECLARE @IndexName NVARCHAR(1024) ,
        @IndexQuery NVARCHAR(1024);

    SELECT  @IndexName = CFG.getTempTableName(0);

	
    SET @IndexQuery = '
	ALTER TABLE #loan
	ADD CONSTRAINT [' + @IndexName
        + '] PRIMARY KEY CLUSTERED([BaseParentID] ASC)WITH (
		    PAD_INDEX = OFF,
		    STATISTICS_NORECOMPUTE = OFF,
		    IGNORE_DUP_KEY = OFF,
		    ALLOW_ROW_LOCKS = ON,
		    ALLOW_PAGE_LOCKS = ON
		) ON [PRIMARY] ';
	
    EXEC (@IndexQuery);

	--SELECT SYSDATETIME()

	
    SELECT  cr.[Value] AS CalcValue ,
    cp.CalculationPersonelID,
            cp.CalendarMonthID ,
            cr.LoanID,
			cm.[MonthName] calcMonthName,
			c.[Year] AS CalcYear
    INTO    #TTT
    FROM    PAY.CalculationResult cr
            INNER JOIN PAY.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID
            INNER JOIN hrm.CalendarMonth AS cm ON cp.CalendarMonthID=cm.CalendarMonthID
            INNER JOIN hrm.Calendar AS c ON c.CalendarID = cm.CalendarID
            INNER JOIN PAY.Parameter ON Parameter.ParameterID = cr.ParameterID
    WHERE   cr.ParameterValueTypeID = 7
            AND CategoryID = 7
            and   cm.StartDate BETWEEN ( SELECT   StartDate
                                   FROM     HRM.CalendarMonth AS cm2
                                   WHERE    cm2.CalendarMonthID = @FromCalendarMonthId
                                 )
                         AND     ( SELECT   StartDate
                                   FROM     HRM.CalendarMonth AS cm3
                                   WHERE    cm3.CalendarMonthID = @ToCalendarMonthId
                                 )
            AND cp.CalculationTypeID = 1;



    SELECT  lon.* ,
            ISNULL(sett.Settlement,0) + ISNULL(csettle.[Value],0) AS sett ,
            t.CalcValue ,
			calcMonthName,
			CalcYear,
			t.CalculationPersonelID 
    INTO    #SelALlLoan
    FROM    hrm.CalendarMonth AS cm
    Inner join  #loan lon on lon.Date>=cm.StartDate
            left JOIN #TTT t ON t.LoanID = lon.BaseParentID and t.CalendarMonthID = cm.CalendarMonthID
            LEFT JOIN ( SELECT  l.CalendarMonthID ,
                                BaseParentID ,
                                SUM(Settlement) AS Settlement
                        FROM    PAY.Loan l
                        join hrm.CalendarMonth AS cm on l.[Date] between cm.StartDate and cm.EndDate
                        WHERE   [Type] = 3
                        and l.[Date] between @StartDate and @EndDate
                        GROUP BY BaseParentID ,
                                l.CalendarMonthID
                      ) sett ON cm.CalendarMonthID = sett.CalendarMonthID and lon.LoanID = sett.BaseParentID
                      
             left join (SELECT cp.CalendarMonthID,cp.PersonelID,cr.LoanID,cr.[Value],cr.ParameterValueTypeID FROM pay.CalculationPersonel AS cp
             join pay.CalculationResult AS cr on cr.CalculationPersonelID = cp.CalculationPersonelID
             join pay.CalculationType AS ct on ct.CalculationTypeID = cp.CalculationTypeID and ct.EngName = 'Settlement' 
             and cr.ParameterValueTypeID = 7
              ) CSettle on csettle.CalendarMonthID = cm.CalendarMonthID and lon.LoanID = CSettle.LoanID      
   WHERE cm.Startdate >=@StartDate and cm.EndDate <= @EndDate;

   

   
    SELECT  case when @CultureNo = 1 then p3.Title
	             when @CultureNo = 2 then p3.Title2
	        end as Title,
			case when @CultureNo = 1 then p3.LastName
	            when @CultureNo = 2 then p3.LastName2
	        end as LastName,
            l.LoanID ,
            l.PersonelID ,
            l.ParameterID ,
            l.Number ,
            CFG.GetCLRSaturnDate(l.Date, 'YY/MM/DD', 0, 0) AS LastEditDate ,
            l.TotalAmount ,
            ISNULL(RemainLoan.Value, 0) - ISNULL(l.sett,0) AS Remain ,
            l.sett AS Settlement ,
            l.InstallmentCount ,
            l.CalcValue AS InstallmentAmount ,
	      -- l.[Description],
			case when @CultureNo = 1 then p.Title
	             when @CultureNo = 2 then p.Title2
	        end as ParameterTitle,
            p2.Code ,
           -- cm.MonthName ,
            l.FacilitiesNumber ,
            --CASE WHEN l.ParentID IS NULL THEN cm.MonthName
            --     ELSE cm2.MonthName
            --END AS DeclareMonthName ,
            CASE WHEN l2.TotalAmount IS NULL THEN l.TotalAmount
                 ELSE l2.TotalAmount
            END AS AssignTotalAmount,

			calcMonthName AS MonthName,
			CalcYear,
			ISNULL(
			CASE 
			WHEN l.RoundPayment=3 AND l.TotalRound<>0 THEN CAST(RemainLoan.Value /l.InstallmentAmount AS INT)+1
			ELSE CAST(RemainLoan.Value /l.InstallmentAmount AS INT) END ,0)
            AS RemainInstallment
			

    FROM    #SelALlLoan l
            INNER JOIN PAY.Parameter p ON p.ParameterID = l.ParameterID
            INNER JOIN HRM.Personel p2 ON p2.PersonelID = l.PersonelID
            INNER JOIN CFG.Party p3 ON p3.PartyID = p2.PartyID
            LEFT JOIN PAY.Loan l2 ON l2.LoanID = l.ParentID
            LEFT JOIN ( SELECT   cr.[Value] ,
                                cr.LoanID , 
                                cp.CalculationPersonelID
                        FROM    PAY.CalculationResult cr
                        INNER JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID
                        INNER JOIN hrm.CalendarMonth AS cm ON cp.CalendarMonthID=cm.CalendarMonthID
                        WHERE   cr.ParameterValueTypeID = 14
                                AND ( cp.PersonelID IN ( SELECT
                                                              PersonelID
                                                         FROM #SelPersonel ) )
                                AND ( @SelectedParameterID IS NULL
                                      OR cr.ParameterID IN ( SELECT
                                                              value
                                                             FROM
                                                              #selParameter )
                                )
                                and   cm.StartDate BETWEEN ( SELECT   StartDate
                                   FROM     HRM.CalendarMonth AS cm2
                                   WHERE    cm2.CalendarMonthID = @FromCalendarMonthId
                                 )
                         AND     ( SELECT   StartDate
                                   FROM     HRM.CalendarMonth AS cm3
                                   WHERE    cm3.CalendarMonthID = @ToCalendarMonthId
                                 )
            AND cp.CalculationTypeID = 1
                      ) RemainLoan ON RemainLoan.LoanID = l.LoanID
                                      AND RemainLoan.CalculationPersonelID = l.CalculationPersonelID;
