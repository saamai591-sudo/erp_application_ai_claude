------------------------------------- START #9581
CREATE   PROCEDURE [PAY].SpGetMonthlyData
(
    @MontlyDataFilterId       INT,
    @CalendarMonthID          INT,
    @IssueCalendarMonthID     INT,
    @CalculationTypeId        INT,
    @IsForFile                BIT = 0
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @StartDate                     DATE,
	        @EndDate                       DATE,
	        @IssueStartDate                DATE,
	        @IssueEndDate                  DATE,
	        @CultureNo                     VARCHAR(10),
	        @Culture                       VARCHAR(10),
	        @Hour                          INT,
	        @IsForSystemParameterTypes     INT,
	        @Date                          DATE;
	
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;
	
	SELECT @IsForSystemParameterTypes = ISNULL(pmdf.SystemType, 0)
	FROM   PAY.ParameterMonthlyDataFilter AS pmdf
	WHERE  pmdf.ParameterMonthlyDataFilterID = @MontlyDataFilterId;
	
	SELECT @StartDate = cm.StartDate,
	       @EndDate     = cm.EndDate,
	       @Hour        = c.WorkHours
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @CalendarMonthID;
	
	SELECT @IssueStartDate = cm.StartDate,
	       @IssueEndDate = cm.EndDate
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @IssueCalendarMonthID;
	
	SET @Date = @EndDate
	
	IF EXISTS (
	       SELECT 1
	       FROM   pay.ParameterMonthlyData AS pmd
	              JOIN pay.Parameter AS p
	                   ON  p.ParameterID = pmd.ParameterID
	              JOIN pay.ParameterMonthlyDataFilterParameter AS pmdfp
	                   ON  pmdfp.ParameterID = p.ParameterID
	              JOIN pay.ParameterMonthlyDataFilter AS pmdf
	                   ON  pmdf.ParameterMonthlyDataFilterID = pmdfp.ParameterMonthlyDataFilterID
	       WHERE  pmd.CalendarMonthID = @CalendarMonthID
	              AND pmdf.ParameterMonthlyDataFilterID = @MontlyDataFilterId
	   )
	BEGIN
	    SET @Date = null
	END
	
	
	DECLARE @NeedConfirm BIT;
	
	SELECT @NeedConfirm = ConfigValue
	FROM   CFG.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm';
	
	
	DECLARE @PersonelCode       BIT,
	        @PersonelName       BIT,
	        @WorkPlace          BIT,
	        @CostCenter         BIT,
	        @Branch             BIT,
	        @EmploymentType     BIT,
	        @NationalCode       BIT;
	
	SELECT @PersonelCode = pmdf.PersonelCode,
	       @PersonelName       = pmdf.PersonelName,
	       @WorkPlace          = pmdf.WorkPlace,
	       @CostCenter         = pmdf.CostCenter,
	       @Branch             = pmdf.Branch,
	       @EmploymentType     = pmdf.EmploymentType,
	       @NationalCode       = pmdf.NationalCode
	FROM   PAY.ParameterMonthlyDataFilter pmdf
	WHERE  pmdf.ParameterMonthlyDataFilterID = @MontlyDataFilterId;
	
	
	SELECT pmdfp.ParameterID,
	       pmdfet.EmploymentTypeID,
	       cm.CalculationMethodID
	INTO   #T
	FROM   PAY.ParameterMonthlyDataFilterEmploymentType pmdfet
	       INNER JOIN PAY.ParameterMonthlyDataFilterParameter pmdfp
	            ON  pmdfp.ParameterMonthlyDataFilterID = pmdfet.ParameterMonthlyDataFilterID
	       INNER JOIN PAY.Parameter p
	            ON  p.ParameterID = pmdfp.ParameterID
	       INNER JOIN PAY.ParameterType AS pt
	            ON  pt.ParameterTypeID = p.ParameterTypeID
	       LEFT JOIN PAY.CalculationMethod cm
	            ON  cm.EmploymentTypeID = pmdfet.EmploymentTypeID
	            AND pmdfp.ParameterID = cm.ParameterID
	WHERE  cm.IsActive = 1
	       AND p.CalculationTypeID = @CalculationTypeId
	       AND pmdfet.ParameterMonthlyDataFilterID = @MontlyDataFilterId;
	--AND pt.EngName = CASE
	--                      WHEN @IsForSystemParameterTypes = 1 THEN 'SystemType'
	--                      ELSE 'ManualInput'
	--                 END
	
	SELECT DISTINCT
	       ParameterID
	INTO   #selParameter
	FROM   #T
	WHERE  NOT EXISTS
	       (
	           SELECT *
	           FROM   #T T2
	           WHERE  T2.ParameterID = #T.ParameterID
	                  AND T2.CalculationMethodID IS NULL
	       );
	
	SELECT *
	INTO   #ChangePersonelStatus
	FROM   HRM.ChangePersonelStatus;
	
	
	SELECT T.AgreementID,
	       T.PersonelID,
	       T.EmploymentTypeID,
	       T.EmploymentType,
	       CostCenter,
	       T.BranchID,
	       WorkPlace,
	       WorkPlace2,
	       t.EmploymentType2,
	       t.CostCenter2
	INTO   #validAgg
	FROM   (
	           SELECT a.*,
	                  et.Title  AS EmploymentType,
	                  et.Title2 EmploymentType2,
	                  cc.Title  AS CostCenter,
	                  cc.Title2  AS CostCenter2,
	                  wp.Title  AS WorkPlace,	                  
	                  wp.Title2  AS WorkPlace2,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   HRM.Agreement a
	                  INNER JOIN HRM.EmploymentType et
	                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                  INNER JOIN CFG.CostCenter cc
	                       ON  cc.CostCenterID = a.CostCenterID
	                  INNER JOIN HRM.WorkPlace wp
	                       ON  wp.WorkPlaceID = a.WorkPlaceID
	           WHERE  a.ExecuteDate <= @EndDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @IssueEndDate
	                             )
	                      )
	                  AND a.IssueDate <= @IssueEndDate
	       ) T
	       LEFT JOIN (
	                SELECT *
	                FROM   (
	                           SELECT *,
	                                  ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
	                           FROM   #ChangePersonelStatus cps
	                           WHERE  cps.ChangeDate <= @StartDate
	                                  AND cps.IssueDate <= @IssueEndDate
	                       ) T1
	                WHERE  Rno = 1
	            ) TStart
	            ON  T.PersonelID = TStart.PersonelID
	       LEFT JOIN (
	                SELECT *
	                FROM   (
	                           SELECT *,
	                                  ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
	                           FROM   #ChangePersonelStatus cps
	                           WHERE  cps.ChangeDate <= @EndDate
	                                  AND cps.IssueDate <= @IssueEndDate
	                       ) T1
	                WHERE  Rno = 1
	            ) TEnd
	            ON  TEnd.PersonelID = T.PersonelID
	       LEFT JOIN (
	                SELECT *
	                FROM   (
	                           SELECT cps.PersonelID,
	                                  COUNT(*) AS cnt
	                           FROM   HRM.ChangePersonelStatus cps
	                           WHERE  cps.ChangeDate <= @EndDate
	                                  AND cps.ChangeDate >= @StartDate
	                                  AND cps.IssueDate <= @IssueEndDate
	                                  AND cps.[STATUS] = 5
	                           GROUP BY
	                                  cps.PersonelID
	                       ) T1
	            ) TInside
	            ON  TInside.PersonelID = T.PersonelID
	WHERE  T.Rno = 1
	       AND (
	               TEnd.[STATUS] = 5
	               OR TStart.[STATUS] = 5
	               OR TInside.cnt <> 0
	           );
	
	SELECT p.PersonelID,
	       a.BranchID,
	       CASE 
	            WHEN @CultureNo = 1 THEN b.Title
	            ELSE b.Title2
	       END                            AS Branch,
	       p.Code                         AS PersonelCode,
	       CASE 
	            WHEN @CultureNo = 1 THEN p2.Title
	            ELSE p2.Title2 END + ' ' + CASE 
	                                        WHEN @CultureNo = 1 THEN ISNULL(p2.LastName, '')
	                                        ELSE p2.LastName2 
	                                   END AS PersonelName,
	       CASE WHEN @CultureNo  = 1 then a.WorkPlace else a.WorkPlace2 END WorkPlace,
	       CASE WHEN @CultureNo = 1 then  a.CostCenter else a.CostCenter END CostCenter,
	       CASE WHEN @CultureNo = 1 then  a.EmploymentType else a.EmploymentType2 END EmploymentType,
	       ISNULL(p2.IdentificationCode, p2.FidaIdCode) AS NationalCode,
	       CAST(CASE WHEN calc.PersonelID IS NULL THEN 1 ELSE 0 END AS BIT) AS IsEnable
	INTO   #selPersonel
	FROM   HRM.Personel p
	       INNER JOIN #validAgg a
	            ON  a.PersonelID = p.PersonelID
	       INNER JOIN HRM.EmploymentType et
	            ON  et.EmploymentTypeID = a.EmploymentTypeID
	       INNER JOIN PAY.ParameterMonthlyDataFilterEmploymentType pmdfet
	            ON  pmdfet.EmploymentTypeID = et.EmploymentTypeID
	       INNER JOIN CFG.Branch b
	            ON  a.BranchID = b.BranchID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID
	       LEFT JOIN (
	                SELECT DISTINCT
	                       cp.PersonelID
	                FROM   PAY.CalculationPersonel cp
	                WHERE  cp.CalendarMonthID = @IssueCalendarMonthID
	                       AND cp.CalculationTypeID = @CalculationTypeId
	            ) calc
	            ON  calc.PersonelID = p.PersonelID
	       INNER JOIN CFG.vwBranchAccess  AS vba
	            ON  a.BranchID = vba.BranchID
	WHERE  pmdfet.ParameterMonthlyDataFilterID = @MontlyDataFilterId;
	
	DECLARE @Query NVARCHAR(MAX);
	DECLARE @selColumns VARCHAR(MAX);
	
	SET @selColumns = '';
	IF @NationalCode = 1
	    SET @selColumns = @selColumns + '#SelPersonel.NationalCode,';
	
	IF @PersonelCode = 1
	    SET @selColumns = @selColumns + '#SelPersonel.PersonelCode,';
	
	IF @PersonelName = 1
	    SET @selColumns = @selColumns + '#SelPersonel.PersonelName,';
	
	IF @WorkPlace = 1
	    SET @selColumns = @selColumns + '#SelPersonel.WorkPlace,';
	
	IF @CostCenter = 1
	    SET @selColumns = @selColumns + '#SelPersonel.CostCenter,';
	
	IF @Branch = 1
	    SET @selColumns = @selColumns + '#SelPersonel.Branch,';
	
	IF @EmploymentType = 1
	    SET @selColumns = @selColumns + '#SelPersonel.EmploymentType,';
	
	
	IF @IsForSystemParameterTypes = 2
	   AND @Date IS NOT null
	BEGIN
	    SET @Query = 
	        N'
		SELECT 1 as IsEnable,P2.ParameterId,Id as DocumentId,ItemType, p2.title as ParameterTitle,Pay.vwPersonelDebit.Title as BaseTitle, P.PersonelID,'
	        + @selColumns
	        + 
	        N' RemainValue as Value FROM Pay.vwPersonelDebit
			Inner join Hrm.Personel p on p.PersonelId=Pay.vwPersonelDebit.PersonelId
		INNER JOIN #SelPersonel on #selPersonel.PersonelID=P.PersonelID
		AND Pay.vwPersonelDebit.CurrencyID=-1 AND Pay.vwPersonelDebit.BranchID=#selPersonel.BranchId
		AND Pay.vwPersonelDebit.[Date]<=''' + CAST(@Date AS VARCHAR(48))
	        + 
	        N'''
		Inner join pay.Parameter p2
		on p2.PaymentTypeId=Pay.vwPersonelDebit.PaymentTypeId
		Inner Join #selParameter Pa
		on pa.ParameterId=p2.ParameterId
		WHERE RemainValue>0 ';
	    
	    PRINT @Query;
	    EXEC (@Query);
	    
	    RETURN;
	END;
	
	
	SELECT Pa.ParameterID,
	       Pe.PersonelID,
	       Pe.PersonelCode,
	       Pe.PersonelName,
	       Pe.WorkPlace,
	       Pe.IsEnable,
	       T.[Value],
	       T.ParameterMonthlyDataID
	INTO   #Values
	FROM   #selPersonel Pe
	       CROSS JOIN #selParameter Pa
	       LEFT JOIN (
	                SELECT *
	                FROM   PAY.ParameterMonthlyData pmd
	                WHERE  pmd.CalendarMonthID = @CalendarMonthID
	                       AND pmd.IssueCalendarMonthID = @IssueCalendarMonthID
	            ) T
	            ON  T.ParameterID = Pa.ParameterID
	            AND T.PersonnelID = Pe.PersonelID;
	
	IF @IsForSystemParameterTypes = 0 --OR @IsForSystemParameterTypes = 1
	BEGIN
	    DECLARE @params           VARCHAR(MAX),
	            @ParamsSelect     VARCHAR(MAX);
	    
	    SELECT @params = STUFF(
	               (
	                   SELECT ',' + QUOTENAME(Pa.ParameterID)
	                   FROM   #selParameter Pa
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
	    
	    
	    IF @IsForFile = 0
	    BEGIN
	        SELECT @ParamsSelect = STUFF(
	                   (
	                       SELECT ',' + QUOTENAME(Pa.ParameterID) + ' as P_' + CAST(Pa.ParameterID AS VARCHAR(10))
	                       FROM   #selParameter Pa
	                              INNER JOIN PAY.Parameter p
	                                   ON  p.ParameterID = Pa.ParameterID
	                                       FOR XML PATH(''),
	                              TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	    END;
	ELSE
	BEGIN
	    SELECT @ParamsSelect = STUFF(
	               (
	                   SELECT ','
	                          + CASE 
	                                 WHEN p.DataEntryType = 2 THEN 'CFG.ConvertToHourMinute(' + QUOTENAME(Pa.ParameterID) 
	                                      + ') as P_'
	                                      + CAST(Pa.ParameterID AS VARCHAR(10))
	                                 WHEN p.DataEntryType = 3 THEN 'CFG.ConvertToDayHourMinute(' + QUOTENAME(Pa.ParameterID) 
	                                      + ','
	                                      + CAST(@Hour AS VARCHAR(10)) + ') as P_' + CAST(Pa.ParameterID AS VARCHAR(10))
	                                 ELSE QUOTENAME(Pa.ParameterID) + ' as P_' + CAST(Pa.ParameterID AS VARCHAR(10))
	                            END
	                   FROM   #selParameter Pa
	                          INNER JOIN PAY.Parameter p
	                               ON  p.ParameterID = Pa.ParameterID
	                                   FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
	END;
	
	SET @Query = N' select P.PersonelID,' + @selColumns + N' ' + @ParamsSelect
	    + 
	    N',IsEnable  from (
	
				SELECT *
				FROM    (
					SELECT ParameterID,PersonelID,[Value]
					FROM #Values
				) x
				PIVOT(
					MAX(VALUE)
					FOR ParameterID IN (' + @params
	    + N')
				) as T ) P 
				Inner join #SelPersonel on #selPersonel.PersonelID=P.PersonelID
				';
	
	PRINT @Query;
	EXEC (@Query);
END;

ELSE 
IF @IsForSystemParameterTypes = 1
BEGIN
    SELECT PersonelID
    INTO   #ShiftAssignment
    FROM   ATN.PersonnelShiftAssignmentItem psai
    WHERE  psai.[Date] <= @EndDate
    GROUP BY
           PersonelID;
    
    SELECT @params = STUFF(
               (
                   SELECT ',' + QUOTENAME(Pa.ParameterID)
                   FROM   #selParameter Pa
                          FOR XML PATH(''),
                          TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
    
    IF @IsForFile = 0
    BEGIN
        SELECT @ParamsSelect = STUFF(
                   (
                       SELECT ',' + QUOTENAME(Pa.ParameterID) + ' as P_' + CAST(Pa.ParameterID AS VARCHAR(10))
                       FROM   #selParameter Pa
                              INNER JOIN PAY.Parameter p
                                   ON  p.ParameterID = Pa.ParameterID
                                       FOR XML PATH(''),
                              TYPE
                   ).value('.', 'NVARCHAR(MAX)'),
                   1,
                   1,
                   ''
               );
    END;
ELSE
BEGIN
    SELECT @ParamsSelect = STUFF(
               (
                   SELECT ','
                          + CASE 
                                 WHEN p.DataEntryType = 2 THEN 'CFG.ConvertToHourMinute(' + QUOTENAME(Pa.ParameterID) + 
                                      ') as P_'
                                      + CAST(Pa.ParameterID AS VARCHAR(10))
                                 WHEN p.DataEntryType = 3 THEN 'CFG.ConvertToDayHourMinute(' + QUOTENAME(Pa.ParameterID) 
                                      + ','
                                      + CAST(@Hour AS VARCHAR(10)) + ') as P_' + CAST(Pa.ParameterID AS VARCHAR(10))
                                 ELSE QUOTENAME(Pa.ParameterID) + ' as P_' + CAST(Pa.ParameterID AS VARCHAR(10))
                            END
                   FROM   #selParameter Pa
                          INNER JOIN PAY.Parameter p
                               ON  p.ParameterID = Pa.ParameterID
                                   FOR XML PATH(''),
                          TYPE
               ).value('.', 'NVARCHAR(MAX)'),
               1,
               1,
               ''
           );
END;

SET @Query = N' select P.PersonelID,' + @selColumns + N' ' + @ParamsSelect
    + 
    N',IsEnable  from (
	
	SELECT *
	FROM    (
					SELECT ParameterID,PersonelID,[Value]
					FROM #Values
				) x
				PIVOT(
					MAX(VALUE)
					FOR ParameterID IN (' + @params
    + 
    N')
				) as T ) P 
				Inner join #SelPersonel on #selPersonel.PersonelID=P.PersonelID
				left join #ShiftAssignment sha on #selPersonel.PersonelID=sha.PersonelID
					   where sha.personelId is null
				 
				';

PRINT @Query;
EXEC (@Query);
END;


ELSE 
IF @IsForSystemParameterTypes = 2
   AND @Date IS NULL
BEGIN
    SET @Query = N' select #Values.Value ,p.ParameterId, vpd.Title as BaseTitle , #SelPersonel.PersonelID,' + 
        @selColumns
        + 
        N' #SelPersonel.IsEnable,
						p.Title as ParameterTitle , 
						
			CASE 
				WHEN PaymentSubjectID is not null  THEN 1
				 WHEN DebitCreditNoteItemID is not null  THEN 2
				  WHEN PettyCashCostItemID is not null  THEN 3
				ELSE NULL
		   END as ItemType,
		   
		   CASE 
				WHEN PaymentSubjectID is not null  THEN PaymentSubjectID
				 WHEN DebitCreditNoteItemID is not null  THEN DebitCreditNoteItemID
				  WHEN PettyCashCostItemID is not null  THEN PettyCashCostItemID
				ELSE NULL
		   END as DocumentId
		   FROM   #Values
						INNER JOIN  #SelPersonel
						ON  #SelPersonel.PersonelID=#Values.PersonelID
						INNER JOIN pay.Parameter p 
						ON p.ParameterID=#Values.ParameterID
						inner join  Pay.ParameterMonthlyData AS pmd
						on pmd.ParameterMonthlyDataId=#Values.ParameterMonthlyDataId
						Inner join Hrm.Personel on  Hrm.Personel.PersonelId =#SelPersonel.PersonelID
						Inner join  FIN.vwPartyDebit vpd
						 on vpd.PartyID = Hrm.Personel.PartyID
						AND (
								(vpd.ItemType = 1 AND pmd.PaymentSubjectID = vpd.Id)
								OR (vpd.ItemType = 2 AND pmd.DebitCreditNoteItemID = vpd.Id)
								OR (vpd.ItemType = 3 AND pmd.PettyCashCostItemID = vpd.Id)
						)
			';
    
    PRINT @Query;
    EXEC (@Query);
END;

END;
