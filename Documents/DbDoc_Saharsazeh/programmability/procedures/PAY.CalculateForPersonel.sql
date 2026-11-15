------------------------------------- 
CREATE   PROCEDURE [PAY].CalculateForPersonel
(
    @CalendarMonthId INT,
    @CalcTypeId INT,
    @SelectedPersonnelID VARCHAR(MAX),
    @UserName NVARCHAR(512),
    @CalcBackPay BIT = 0,
    @UseTransaction BIT = 1,
    @ISforce TINYINT = 0
)

--WITH ENCRYPTION
AS
SET NOCOUNT ON;

DECLARE @CalcTypeEngName VARCHAR(20),
        @PayTimeType BIT,
        @UserId INT,
        @EstablishmentMonthID INT,
        @NeedConfirm BIT,
        @message NVARCHAR(MAX),
        @EstablishmentMonthStartDate DATE,
        @CurrentStartDate DATE,
        @CurrentEndDate DATE,
        @CurrentYear INT;

SELECT @CalcTypeEngName = ct.EngName,
       @PayTimeType = ct.PayTimeType
FROM pay.CalculationType AS ct
WHERE ct.CalculationTypeID = @CalcTypeId;

SELECT @CurrentStartDate = cm.StartDate,
       @CurrentEndDate = cm.EndDate,
       @CurrentYear = c.CalendarID
FROM HRM.CalendarMonth cm
    JOIN hrm.Calendar AS c
        ON c.CalendarID = cm.CalendarID
WHERE cm.CalendarMonthID = @CalendarMonthId;

SELECT @NeedConfirm = ConfigValue
FROM CFG.Configuration c
WHERE c.ConfigKey = 'AgreementNeedConfirm';


SELECT @EstablishmentMonthID = c.ConfigValue
FROM CFG.Configuration c
WHERE c.ConfigKey = 'CalendarMonth';


IF @EstablishmentMonthID IS NULL
BEGIN
    SET @message = N'E_' + N'لطفا ماه استقرار را در تنظيمات مشخص نماييد.' + CHAR(13) + CHAR(10);


    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

    RETURN;
END;

DECLARE @Personel TABLE
(
    [Value] INT
);


INSERT INTO @Personel
SELECT Value
FROM CFG.R_FnCommaStr2Table(@SelectedPersonnelID) rfcst;


SELECT PersonelID,
       T.EmploymentTypeID,
	   t.ExpireDate
INTO #lastAggr
FROM
(
    SELECT a.PersonelID,
           a.EmploymentTypeID,
           ROW_NUMBER() OVER (PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno,
		   a.ExpireDate
    FROM HRM.Agreement a
        INNER JOIN @Personel AS p
            ON p.Value = a.PersonelID
    WHERE a.ExecuteDate <= @CurrentEndDate
          AND
          (
              @NeedConfirm = 0
              OR
              (
                  a.ConfirmDate IS NOT NULL
                  AND a.ConfirmDate <= @CurrentEndDate
              )
          )
          AND a.IssueDate <= @CurrentEndDate
) T
WHERE T.Rno = 1;

CREATE TABLE #ValidPersonel
(
    Id INT
);
INSERT INTO #ValidPersonel
EXEC [PAY].[GetValidPersonelForCalculation] @CalendarMonthId,
                                            @CalcTypeId,
                                            NULL,
                                            1;

  IF EXISTS
    (select 1 from #lastAggr
	where ExpireDate<=@CurrentStartDate
    )
    BEGIN
   
    SET @message = N'E_' + N'تاریخ انقضاء برخی از افراد انتخاب شده، کوچکتر از تاریخ شروع ماه انتخاب شده است..' + CHAR(13) + CHAR(10);


    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

        RETURN;
    END;



IF EXISTS
(
    SELECT 1
    FROM @Personel
        LEFT JOIN #ValidPersonel
            ON #ValidPersonel.Id = [Value]
    WHERE #ValidPersonel.Id IS NULL
)
BEGIN
    SET @message
        = N'E_' + N'براي برخي از افراد انتخاب شده امکان محاسبه نمی باشد لطفا لیست را بروز رسانی نمایید.' + CHAR(13)
          + CHAR(10);

    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

    RETURN;
END;




SELECT t.Rn,
       t.CalculationMethodID,
       t.ParameterID,
       t.Title,
	   t.IsActive
INTO #WithoutFormulaParameters
FROM
(
    SELECT ROW_NUMBER() OVER (PARTITION BY cm.ParameterID,
                                           cm.EmploymentTypeID
                              ORDER BY cm2.EndDate DESC
                             ) Rn,
           cm.CalculationMethodID,
           p.ParameterID,
           p.Title,
		   cm.IsActive
    FROM PAY.Parameter AS p
        JOIN PAY.CalculationMethod AS cm
            ON cm.ParameterID = p.ParameterID
        JOIN HRM.CalendarMonth AS cm2
            ON cm2.CalendarMonthID = cm.EfficientCalendarMonthID
    WHERE p.ParameterTypeID IN ( 4, 5 )
          AND cm2.EndDate <= @CurrentEndDate
          AND p.CalculationTypeID = @CalcTypeId
) t
    LEFT JOIN PAY.Formula AS f
        ON f.CalculationMethodID = t.CalculationMethodID
WHERE t.Rn = 1
      AND f.Expression IS NULL
	  and t.IsActive = 1;

IF EXISTS (SELECT 1 FROM #WithoutFormulaParameters AS wfp)
BEGIN
    DECLARE @parameters NVARCHAR(MAX);
    SELECT @parameters
        = STUFF(
    (
        SELECT ' ,' + Title FROM #WithoutFormulaParameters FOR XML PATH(''), TYPE
    ).value('.', 'nvarchar(max)'),
    1   ,
    2   ,
    ''
               );

    SET @message = N'E_' + N'برای عامل های زیر فرمول تعریف نشده است.' + CHAR(13) + CHAR(10) + @parameters;

    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

    RETURN;
END;

IF @ISforce < 1
   AND EXISTS
(
    SELECT 1
    FROM PAY.vwPersonelDebit AS vpd
        INNER JOIN HRM.Personel AS p
            ON p.PartyID = vpd.PartyID
        INNER JOIN @Personel Pr
            ON Pr.[Value] = p.PersonelID
        INNER JOIN PAY.Parameter AS p2
            ON p2.PaymentTypeID = vpd.PaymentTypeID
    WHERE p2.CalculationTypeID = @CalcTypeId
          AND vpd.RemainValue > 0
          AND vpd.[Date] <= @CurrentEndDate
          AND p2.CategoryID <> 7
)
BEGIN
    SET @message
        = N'E_C_' + N'برخی از پرداختهای مرتبط با «نوع محاسبه» ورود اطلاعات نشده اند. آیا ادامه می دهید.' + CHAR(13)
          + CHAR(10);

    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

    RETURN;
END;

IF (@ISforce < 2)
   AND EXISTS
(
    SELECT 1
    FROM PAY.vwPersonelLoanDebit AS vpd
        INNER JOIN HRM.Personel AS p
            ON p.PartyID = vpd.PartyID
        INNER JOIN @Personel Pr
            ON Pr.[Value] = p.PersonelID
        INNER JOIN PAY.Parameter AS p2
            ON p2.PaymentTypeID = vpd.PaymentTypeID
    WHERE p2.CalculationTypeID = @CalcTypeId
          AND vpd.RemainValue > 0
          AND vpd.[Date] <= @CurrentEndDate
)
BEGIN
    SET @message
        = N'E_CC_' + N'برای برخی پرداختهای از نوع وام، در حقوق، وام تعریف نشده است آیا ادامه می دهید؟' + CHAR(13)
          + CHAR(10);

    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

    RETURN;
END;

IF @ISforce < 3
   AND EXISTS
(
    SELECT 1
    FROM #lastAggr la
        JOIN pay.CalculationMethod cm
            ON la.EmploymentTypeID = cm.EmploymentTypeID
        JOIN pay.Parameter p
            ON cm.ParameterID = p.ParameterID
               AND p.DependantToYear = 1
        JOIN hrm.CalendarMonth cm2
            ON cm.EfficientCalendarMonthID = cm2.CalendarMonthID
    WHERE cm2.EndDate <= @CurrentEndDate
          AND cm.IsActive = 1
)
   AND NOT EXISTS
(
    SELECT 1
    FROM pay.Parameter AS p
        JOIN pay.CalculationMethod AS cm
            ON cm.ParameterID = p.ParameterID
        JOIN hrm.CalendarMonth AS cm2
            ON cm2.CalendarMonthID = cm.EfficientCalendarMonthID
        JOIN hrm.Calendar AS c
            ON c.CalendarID = cm2.CalendarID
        JOIN #lastAggr la
            ON cm.EmploymentTypeID = la.EmploymentTypeID
    WHERE ISNULL(p.DependantToYear, 0) = 1
          AND c.CalendarID = @CurrentYear
)
BEGIN
    SET @message = N'E_CCC_' + N'برای بعضی از عاملهای وابسته به سال، در سال جاری روش محاسبه تعیین نشده است.';


    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --
    RETURN;
END;


IF @CalcTypeEngName <> 'Pay'
   AND @PayTimeType = 0
   AND EXISTS
(
    SELECT 1
    FROM @Personel Pr
        LEFT JOIN
        (
            SELECT cp.CalculationPersonelID,
                   cp.PersonelID
            FROM pay.CalculationPersonel AS cp
                JOIN pay.CalculationType AS ct
                    ON ct.CalculationTypeID = cp.CalculationTypeID
            WHERE ct.EngName = 'Pay'
                  AND cp.CalendarMonthID = @CalendarMonthId
        ) CalculatedPersonel
            ON Pr.[Value] = CalculatedPersonel.PersonelID
    WHERE CalculatedPersonel.CalculationPersonelID IS NULL
)
BEGIN
    SET @message = N'E_' + N'برای برخی از افراد انتخاب شده محاسبه حقوق انجام نشده است.' + CHAR(13) + CHAR(10);


    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

    RETURN;
END;

IF @EstablishmentMonthID <> @CalendarMonthId
   AND @CalcTypeId = 1
BEGIN
    SELECT @EstablishmentMonthStartDate = cm.StartDate
    FROM HRM.CalendarMonth cm
    WHERE cm.CalendarMonthID = @EstablishmentMonthID;





    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY ps.PersonelID ORDER BY ps.IssueDate DESC) AS Rno
    INTO #changeItems
    FROM HRM.ChangePersonelStatus ps
        INNER JOIN @Personel P
            ON ps.PersonelID = P.Value;

    SELECT PersonelID,
           STATUS,
           ChangeDate,
           IssueDate
    INTO #changeItems2
    FROM #changeItems
    WHERE STATUS = 5
          AND ISNULL(
              (
                  SELECT STATUS
                  FROM #changeItems tt
                  WHERE tt.PersonelID = #changeItems.PersonelID
                        AND tt.Rno = #changeItems.Rno + 1
              ),
              100
                    ) <> 5;


    SELECT PersonelID,
           IssueDate AS ExecuteDate
    INTO #TP
    FROM
    (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY PersonelID ORDER BY ChangeDate DESC) AS Rno
        FROM #changeItems2
    ) T
    WHERE Rno = 1;


    DECLARE @lastMonthStartDate DATE;

    SELECT TOP 1
           @lastMonthStartDate = StartDate
    FROM HRM.CalendarMonth AS cm
    WHERE cm.StartDate < @CurrentStartDate
    ORDER BY cm.StartDate DESC;



    IF EXISTS
    (
        SELECT cm.CalendarMonthID
        FROM HRM.CalendarMonth cm
            INNER JOIN #TP
                ON #TP.ExecuteDate <= cm.EndDate
            LEFT JOIN PAY.CalculationPersonel cp
                ON cp.PersonelID = #TP.PersonelID
                   AND cp.CalculationTypeID = @CalcTypeId
                   AND cp.CalendarMonthID = cm.CalendarMonthID
        WHERE cm.StartDate >= @EstablishmentMonthStartDate
              AND cm.StartDate = @lastMonthStartDate
              AND cp.PersonelID IS NULL
    )
    BEGIN

        SET @message = N'E_' + N'براي برخي از افراد انتخاب شده محاسبه ماه قبل انجام نشده است.' + CHAR(13) + CHAR(10);


        RAISERROR(   @message, -- Message text.
                     16,       -- Severity,
                     10
                 ); --

        RETURN;
    END;
END;


--SATURNNEW-5054

CREATE TABLE #DependentCalcType
(
    CalcTypeID INT
);


INSERT INTO #DependentCalcType
EXEC PAY.GetDependentCalculationTypeOn @CalculationTypeID = @CalcTypeId,
                                       @CalendarMonthId = @CalendarMonthId,
                                       @ChekForNext = 1;


SELECT ct.Title,
       ct.CalculationTypeID,
       cp.CalcDate,
       cp.PersonelID
INTO #Deps2
FROM PAY.CalculationPersonel cp
    INNER JOIN @Personel P
        ON P.Value = cp.PersonelID
    INNER JOIN #DependentCalcType
        ON #DependentCalcType.CalcTypeID = cp.CalculationTypeID
    INNER JOIN HRM.CalendarMonth AS cm
        ON cm.CalendarMonthID = cp.CalendarMonthID
    INNER JOIN PAY.CalculationType AS ct
        ON ct.CalculationTypeID = cp.CalculationTypeID
WHERE cm.StartDate > @CurrentStartDate;


IF EXISTS (SELECT 1 FROM #Deps2)
BEGIN
    DECLARE @DependentCalcTypeTitle NVARCHAR(MAX),
            @depPCode VARCHAR(100);

    SELECT @DependentCalcTypeTitle = #Deps2.Title,
           @depPCode = p.Code
    FROM #Deps2
        INNER JOIN HRM.Personel AS p
            ON p.PersonelID = #Deps2.PersonelID;

    IF @DependentCalcTypeTitle IS NOT NULL
    BEGIN
        SET @message
            = N'E_' + N'لطفا ابتدا محاسبه ' + @DependentCalcTypeTitle + N'  ' + @depPCode
              + N'  مربوط به ماه های آتی را حذف نماييد.' + CHAR(13) + CHAR(10);


        RAISERROR(   @message, -- Message text.
                     16,       -- Severity,
                     10
                 ); --
        RETURN;
    END;
END;


CREATE TABLE #paramError
(
    ParameterId INT
);


INSERT INTO #paramError
EXEC PAY.CheckFormula NULL, NULL,@CalendarMonthId;

IF EXISTS (SELECT * FROM #paramError)
BEGIN
    DECLARE @Title NVARCHAR(2048);

    SELECT @Title = p.Title
    FROM PAY.Parameter p
        INNER JOIN #paramError
            ON #paramError.ParameterId = p.ParameterId;


    SET @message = N'E_' + N'فرمول مربوط به پارامترهاي زير ايراد دارد.' + CHAR(13) + CHAR(10) + @Title;

    RAISERROR(   @message, -- Message text.
                 16,       -- Severity,
                 10
             ); --

    RETURN;
END;


SET @UserId = CFG.GetuserID();



BEGIN TRY
    IF @UseTransaction = 1
    BEGIN
        BEGIN TRANSACTION;
        SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    END;


    IF @CalcBackPay = 1
        CREATE TABLE #CalculationBackPayResult
        (
            [CalculationPersonelID] [INT] NOT NULL,
            [BackPayCalculationPersonelID] [INT] NOT NULL,
            [ParameterID] [INT] NULL,
            [ParameterValueTypeID] [INT] NOT NULL,
            [Value] [DECIMAL](30, 4) NOT NULL
                DEFAULT ((0)),
            [BackPayValue] [DECIMAL](30, 4) NOT NULL
                DEFAULT ((0)),
            EmployMentTypeID INT
        );



    INSERT INTO [PAY].[CalculationPersonel]
    (
        [PersonelID],
        [CalcDate],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [VoucherID],
        [CalculationTypeID],
        [CalendarMonthID],
		[FishVisibility]
    )
    SELECT rfcst.[Value],
           GETDATE(),
           1,
           @UserId,
           GETDATE(),
           @UserId,
           GETDATE(),
           NULL,
           @CalcTypeId,
           @CalendarMonthId,
		   0
    FROM @Personel rfcst;


    EXEC PAY.Calculate @CalendarMonthId,
                       @CalcTypeId,
                       @SelectedPersonnelID,
                       @CalcBackPay,
                       @UserId,
                       0,
                       @CalendarMonthId;




    IF @CalcBackPay = 1
    BEGIN

        INSERT INTO [PAY].[CalculationBackPayResult]
        (
            [ParameterID],
            [ParameterValueTypeID],
            [Value],
            [BackPayValue],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            [CalculationPersonelID],
            [BackPayCalculationPersonelID]
        )
        SELECT #CalculationBackPayResult.ParameterID,
               ParameterValueTypeID,
               [Value],
               BackPayValue,
               1,
               @UserId,
               GETDATE(),
               @UserId,
               GETDATE(),
               #CalculationBackPayResult.[CalculationPersonelID],
               #CalculationBackPayResult.[BackPayCalculationPersonelID]
        FROM #CalculationBackPayResult
            INNER JOIN PAY.Parameter p
                ON p.ParameterID = #CalculationBackPayResult.ParameterID
        WHERE BackPayValue <> 0
              AND p.ReCalcable = 1
              AND p.CalculationTypeID = @CalcTypeId;

    END;


    INSERT INTO PAY.CalculationResult
    (
        [CalculationPersonelID],
        ParameterID,
        ParameterValueTypeID,
        [Value],
        LoanID,
        Version,
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate
    )
    SELECT crt.[CalculationPersonelID],
           crt.ParameterID,
           crt.ParameterValueTypeID,
           crt.[Value],
           crt.LoanID,
           1,
           @UserId,
           GETDATE(),
           @UserId,
           GETDATE()
    FROM PAY.CalculationResult_temp crt
        INNER JOIN PAY.Parameter p
            ON p.ParameterID = crt.ParameterID
    WHERE crt.[Value] IS NOT NULL
          AND crt.ParameterID IS NOT NULL
          AND crt.ParameterValueTypeID IN ( 7, 16, 14 )
          AND p.CalculationTypeID = @CalcTypeId;



    IF @UseTransaction = 1
        COMMIT;
END TRY
BEGIN CATCH
    IF @UseTransaction = 1
        ROLLBACK;

    DECLARE @ErrorSeverity INT,
            @ErrorMessage2 NVARCHAR(MAX),
            @ErrorState INT;

    SET @ErrorSeverity = ERROR_SEVERITY();
    SET @ErrorMessage2 = ERROR_MESSAGE();
    SET @ErrorState = ERROR_STATE();

    RAISERROR(   @ErrorMessage2, -- Message text.
                 @ErrorSeverity, -- Severity,
                 @ErrorState,    -- State,
                 NULL,           -- First argument.
                 NULL
             ); -- Second argument.
END CATCH;
