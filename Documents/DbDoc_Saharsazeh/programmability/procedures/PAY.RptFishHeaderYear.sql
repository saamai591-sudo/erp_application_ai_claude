
--------------------------------------------------------------
CREATE    PROCEDURE [PAY].RptFishHeaderYear
(
    @CalendarMonthId      INT,
    @CalcTypeID           INT,
    @SelectedPersonel     VARCHAR(MAX) = NULL
)

--WITH ENCRYPTION
AS
	DECLARE @StartDate DATE,
	        @EndDate DATE
	
	DECLARE @Hour INT,
	        @CalendarId INT
	
	DECLARE @tableName VARCHAR(255)
	
	SELECT @tableName = cfg.getTempTableName(1)
	
	DECLARE @payPaymnetTopicID TINYINT
	
	SELECT @payPaymnetTopicID = pt.PaymentTopicID
	FROM   hrm.PaymentTopic pt
	WHERE  pt.EngName = 'Payment'
	
	CREATE TABLE #selPersonel
	(
		PersonelID     INT,
		position       INT
	)
	
	INSERT INTO #selPersonel
	SELECT VALUE,
	       position
	FROM   cfg.R_FnCommaStr2Table(@SelectedPersonel) rfcst
		
	SELECT @StartDate = cm.StartDate,
	       @EndDate        = cm.EndDate,
	       @Hour           = c.WorkHours,
	       @CalendarId     = c.CalendarID
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @CalendarMonthId
		
	DECLARE @params           VARCHAR(MAX),
	        @ParamsSelect     VARCHAR(MAX)
	
	SELECT @params = STUFF(
	           (
	               SELECT ',' + QUOTENAME(pa.ParameterID)
	               FROM   pay.Parameter pa
	               WHERE  pa.SystemName IS NOT NULL --IN ('Khales','KOSOR_SUM','LOAN_SUM','MAZAYA_SUM')
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
		
	SELECT @ParamsSelect = STUFF(
	           (
	               SELECT ',' +
	                      
	                      CASE 
	                           WHEN pa.DataEntryType = 2 THEN 'CFG.ConvertToHourMinute(' + QUOTENAME(pa.ParameterID) 
	                                + ' * 60.00 ) '
	                           WHEN pa.DataEntryType = 3 THEN 'CFG.ConvertToDayHourMinute(' + QUOTENAME(pa.ParameterID) 
	                                + ' * ' + CAST(@Hour AS VARCHAR(10)) + ',' +
	                                CAST(@Hour AS VARCHAR(10)) + ')'
	                           ELSE QUOTENAME(pa.ParameterID)
	                      END
	                      
	                      + ' as ' + QUOTENAME(
	                          CASE 
	                               WHEN pa.SystemName IN('khales','KOSOR_SUM','MAZAYA_SUM') THEN pa.SystemName ELSE 'P' + CAST(pa.ParameterID AS VARCHAR(24))
	                              
	                          END
	                      )
	               FROM   pay.Parameter pa
	               WHERE  pa.CalculationTypeID = @CalcTypeID
	                      AND pa.SystemName IS NOT NULL-- IN ('Khales','KOSOR_SUM','LOAN_SUM','MAZAYA_SUM')
	                          
	                          FOR XML PATH(''),
	                          TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	DECLARE @Query NVARCHAR(MAX)
		
	IF @ParamsSelect IS NOT NULL
	BEGIN
	    SET @Query = 'select PersonelID,' + @ParamsSelect + '
		into ' + @tableName +
	        '
		            FROM ( 
		            
		            SELECT *
	FROM    (
	                SELECT ParameterID,cp.PersonelID,[Value]
	                FROM Pay.CalculationResult cr
	                INNER JOIN pay.CalculationPersonel cp on cr.CalculationPersonelID=cp.CalculationPersonelID
	                INNER JOIN #selPersonel sel
	         ON sel.PersonelID=cp.PersonelID 
	         Inner Join HRM.CalendarMonth cm  on cm.CalendarMonthId=cp.CalendarMonthId
	                where ParameterValueTypeID in (7,16) 
	                AND cm.CalendarId=' +
	        CAST(@CalendarId AS VARCHAR(512)) +
	        '
					AND cm.StartDate<= ''' +
	        CAST(@StartDate AS VARCHAR(512)) +
	        '''
	            ) x
	            PIVOT(
	                SUM(VALUE)
	                FOR ParameterID IN (' + @params +
	        ')
	            ) as T ) P 
	            ' 
	    
	    EXEC (@Query)
	END
	ELSE
	BEGIN
	    SET @Query = 'SELECT PersonelID INTO ' + @tableName +
	        ' FROM #selPersonel'
	    
	    EXEC (@Query)
	END
	
	DECLARE @paramsDef NVARCHAR(2048)
	
	SET @paramsDef = 
	    N'@payPaymnetTopicID int ,@EndDate Date,@CalcTypeID int,@CalendarMonthId int,@CalendarId int,@StartDate date'
	
	SET @Query = N'	SELECT ' + @tableName +
	    '.*,
	       AGG.EmploymentType,
	       AGG.CostCenter,
	       AGG.WorkPlace,
	       AGG.JobTitle,
	       b.Title   AS BankTitle,
	       p.Code    AS PersonelCode,
	       pBankAccount.AccountNumber,
	       p2.Title  AS PersonelName,
	       p2.LastName,
	       p2.IdentificationCode,
	       c2.[Year],
	       cm.MonthName
	FROM   pay.CalculationPersonel cp
	       INNER JOIN #selPersonel
	            ON  #selPersonel.PersonelID = cp.PersonelID
	       INNER JOIN ' + @tableName + '
	            ON  ' + @tableName +
	    '.personelId = cp.PersonelID
	       LEFT JOIN (
	                SELECT T.PersonelID,
	                       T.EmploymentType,
	                       CostCenter,
	                       WorkPlace,
	                       T.JobTitle
	                FROM   (
	                           SELECT a.*,
	                                  et.Title AS EmploymentType,
	                                  cc.Title AS CostCenter,
	                                  wp.Title AS WorkPlace,
	                                  j.Title AS JobTitle,
	                                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.ExecuteDate DESC,a.IssueDate DESC) AS 
	                                  Rno
	                           FROM   hrm.Agreement a
	                                  INNER JOIN hrm.EmploymentType et
	                                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                                  INNER JOIN cfg.CostCenter cc
	                                       ON  cc.CostCenterID = a.CostCenterID
	                                  INNER JOIN hrm.WorkPlace wp
	                                       ON  wp.WorkPlaceID = a.WorkPlaceID
	                                  INNER JOIN hrm.[Job] j
	                                       ON  j.JobID = a.JobID
	                           WHERE  a.ExecuteDate <= @EndDate
	                                 
	                       )T
	                WHERE  Rno = 1
	            ) AGG
	            ON  AGG.PersonelID = cp.PersonelID
	       INNER JOIN hrm.Personel p
	            ON  p.PersonelID = AGG.PersonelID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID
	       INNER JOIN HRM.CalendarMonth cm
	            ON  cm.CalendarMonthID = cp.CalendarMonthID
	       INNER JOIN HRM.Calendar c2
	            ON  c2.CalendarID = cm.CalendarID
	       LEFT JOIN (
	                SELECT *,
	                       ROW_NUMBER() OVER(PARTITION BY pa.PersonelID ORDER BY pa.[Date] DESC) AS 
	                       RNO
	                FROM   hrm.PersonelAccount pa
	                WHERE  pa.PaymentTopicID = @payPaymnetTopicID
	                       AND pa.Date <= @EndDate
	            )pBankAccount
	            ON  p.PersonelID = pBankAccount.PersonelID
	            AND pBankAccount.RNO = 1
	       LEFT JOIN CFG.BankBranch bb
	            ON  bb.BankBranchID = pBankAccount.BankBranchID
	       LEFT JOIN CFG.Bank b
	            ON  b.BankID = bb.BankID
	WHERE  cp.CalculationTypeID = @CalcTypeID
	    
	       --AND cm.CalendarId=@CalendarId
	      -- AND cm.StartDate<=@StartDate
	      AND cm.CalendarMonthId=@CalendarMonthId
	ORDER BY
	       #selPersonel.position'
	
	EXECUTE sp_executesql @QUery,
	     @paramsDef,
	     @payPaymnetTopicID = @payPaymnetTopicID,
	     @CalcTypeID = @CalcTypeID,
	     @EndDate = @EndDate,
	     @CalendarMonthId = @CalendarMonthId,
	     @CalendarId = @CalendarId,
	     @StartDate = @StartDate;	
