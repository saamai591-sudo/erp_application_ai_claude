CREATE   PROCEDURE PAY.RemoveCalculateForPersonel
(
    @CalendarMonthId INT,
    @CalcTypeId INT,
    @SelectedPersonnelID VARCHAR(MAX),
    @UserName NVARCHAR(512)
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @calculationID INT;
    DECLARE @CurrentStartDate DATE,
            @OldStartDate DATE;

    DECLARE @error TABLE (
        [Message] NVARCHAR(100) ,
        IsDetail BIT
    )

    SELECT @CurrentStartDate = cm.StartDate
    FROM HRm.CalendarMonth cm
    WHERE cm.CalendarMonthID = @CalendarMonthId;

    SELECT CAST(VALUE AS INT) AS VALUE
    INTO #personel
    FROM cfg.R_FnCommaStr2Table(@SelectedPersonnelID) rfcst;

    SELECT @OldStartDate = MAX(cm.StartDate)
    FROM pay.CalculationPersonel cp
        INNER JOIN #personel
            ON #personel.VALUE = cp.PersonelID
        INNER JOIN HRM.CalendarMonth cm
            ON cm.CalendarMonthID = cp.CalendarMonthID
    WHERE cp.CalculationTypeID = @CalcTypeId
          AND cp.CalendarMonthID = @CalendarMonthId;

    DECLARE @message NVARCHAR(MAX);

    IF EXISTS
    (
        SELECT 1
        FROM
        (
            SELECT a.CalendarMonthID,
                   b.PersonnelID,
                   c.CalculationTypeID
            FROM pay.PayPreparing a
                JOIN pay.PayPreparingItem b
                    ON a.PayPreparingID = b.PayPreparingID
                JOIN pay.Parameter c
                    ON c.ParameterID = b.ParameterID
            WHERE CalendarMonthID = @CalendarMonthId
                  AND PersonnelID IN
                      (
                          SELECT VALUE FROM #personel
                      )
                  AND CalculationTypeID = @CalcTypeId
        ) a
    )
    BEGIN
        SET @message = N'PayrollManager.Messages.PersonnelHasPaymentArrangement';
	    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);

	    SELECT * from @error;

        RETURN;
    END;

    IF @OldStartDate IS NOT NULL
       AND @OldStartDate > @CurrentStartDate
    BEGIN
        SET @message = N'PayrollManager.Messages.FirstRemoveCalculationForIncomingMonths';
	    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);

	    SELECT * from @error;

        RETURN;
    END;

    CREATE TABLE #DependentCalcType
    (
        CalcTypeID INT
    );

    INSERT INTO #DependentCalcType
    EXEC pay.GetDependentCalculationTypeOn @CalculationTypeID = @CalcTypeId,
                                           @CalendarMonthId = @CalendarMonthId,
                                           @ChekForNext = 0;

    SELECT ct.Title,
           ct.CalculationTypeID,
           cp.CalcDate,
           cp.PersonelID
    INTO #Deps
    FROM pay.CalculationPersonel cp
        INNER JOIN #personel
            ON #personel.VALUE = cp.PersonelID
        INNER JOIN #DependentCalcType
            ON #DependentCalcType.CalcTypeID = cp.CalculationTypeID
        INNER JOIN PAY.CalculationType ct
            ON ct.CalculationTypeID = cp.CalculationTypeID
    WHERE cp.CalendarMonthID = @CalendarMonthId;

    IF EXISTS (SELECT 1 FROM #Deps)
    BEGIN
        DECLARE @DependentCalcTypeTitle NVARCHAR(128),
                @depPCode VARCHAR(100);


        SELECT cp.PersonelID,
               cp.CalcDate
        INTO #Current
        FROM PAY.CalculationPersonel AS cp
            INNER JOIN #personel
                ON #personel.VALUE = cp.PersonelID
        WHERE cp.CalendarMonthID = @CalendarMonthId
              AND cp.CalculationTypeID = @CalcTypeId;


        SELECT @DependentCalcTypeTitle = #Deps.Title,
               @depPCode = p.Code
        FROM #Current
            INNER JOIN #Deps
                ON #Deps.PersonelID = #Current.PersonelID
                   AND #Deps.CalcDate > #Current.CalcDate
            INNER JOIN hrm.Personel AS p
                ON p.PersonelID = #Current.PersonelID;

        IF @DependentCalcTypeTitle IS NOT NULL 
        BEGIN
            SET @message
		    =N'PayrollManager.Messages.FirstDeleteCalculationForCurrentMonth^'
		    + @DependentCalcTypeTitle + N',' + @depPCode;

		    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
		    SELECT * from @error;
		    RETURN;
        END;
    END;

    DELETE #DependentCalcType;

    INSERT INTO #DependentCalcType
    EXEC pay.GetDependentCalculationTypeOn @CalculationTypeID = @CalcTypeId,
                                           @CalendarMonthId = @CalendarMonthId,
                                           @ChekForNext = 1;

    SELECT ct.Title,
           ct.CalculationTypeID,
           cp.CalcDate,
           cp.PersonelID
    INTO #Deps2
    FROM pay.CalculationPersonel cp
        INNER JOIN #personel
            ON #personel.VALUE = cp.PersonelID
        INNER JOIN #DependentCalcType
            ON #DependentCalcType.CalcTypeID = cp.CalculationTypeID
        INNER JOIN hrm.CalendarMonth AS cm
            ON cm.CalendarMonthID = cp.CalendarMonthID
        INNER JOIN PAY.CalculationType AS ct
            ON ct.CalculationTypeID = cp.CalculationTypeID
    WHERE cm.StartDate > @CurrentStartDate;

    IF EXISTS (SELECT 1 FROM #Deps2)
    BEGIN

        SELECT @DependentCalcTypeTitle = #Deps2.Title,
               @depPCode = p.Code
        FROM #Deps2
            INNER JOIN hrm.Personel AS p
                ON p.PersonelID = #Deps2.PersonelID;

        IF @DependentCalcTypeTitle IS NOT NULL 
        BEGIN
            SET @message
		    =N'PayrollManager.Messages.FirstDeleteCalculationForIncomingMonth^'
		    + @DependentCalcTypeTitle + N'  ' + @depPCode;
		
		    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
		    SELECT * from @error;
		    RETURN;
        END;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM Pay.CalculationPersonel cv
            INNER JOIN #personel
                ON #personel.VALUE = cv.PersonelID
        WHERE cv.CalculationTypeID = @CalcTypeId
              AND cv.CalendarMonthID = @CalendarMonthId
              AND cv.voucherid IS NOT NULL
    )
    BEGIN
        SET @message = N'PayrollManager.Messages.PersonnelHasVoucher';
	
	    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
	    SELECT * from @error;
	    RETURN;
    END;

    IF  EXISTS
    (
        SELECT 1
        FROM Pay.CalculationPersonel AS s
            INNER JOIN #personel
                ON #personel.VALUE = s.PersonelID
            INNER JOIN pay.SettlementCalculation AS sc ON s.CalculationPersonelID = sc.BaseCalculationPersonelID
        WHERE s.CalendarMonthID = @CalendarMonthId AND s.CalculationTypeID = @CalcTypeId              
         
    )
    BEGIN
        SET @message = N'PayrollManager.Messages.PersonnelHasSettelment';
	
	    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
	    SELECT * from @error;
	    RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM Pay.CalculationResult cr
            INNER JOIN fin.PaymentSubject AS ps
                ON ps.CalculationResultID = cr.CalculationResultID
            INNER JOIN pay.CalculationPersonel cv
                ON cv.CalculationPersonelID = cr.CalculationPersonelID
            INNER JOIN #personel
                ON #personel.VALUE = cv.PersonelID
        WHERE cv.CalculationTypeID = @CalcTypeId
              AND cv.CalendarMonthID = @CalendarMonthId
    )
    BEGIN
	    SET @message = N'PayrollManager.Messages.InformationIsUsedInPaymentReciept';

	    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);

	    INSERT @error
	    SELECT DISTINCT N'PayrollManager.Messages.InPaymentReceiptWithNumber^' + CAST(pr.Number AS nvarchar), 1
        FROM Pay.CalculationResult cr
            INNER JOIN fin.PaymentSubject AS ps
                ON ps.CalculationResultID = cr.CalculationResultID
		    join fin.PaymentReceipt AS pr
		        ON ps.PaymentReceiptID = pr.PaymentReceiptID
            INNER JOIN pay.CalculationPersonel cv
                ON cv.CalculationPersonelID = cr.CalculationPersonelID
            INNER JOIN #personel
                ON #personel.VALUE = cv.PersonelID
        WHERE cv.CalculationTypeID = @CalcTypeId
              AND cv.CalendarMonthID = @CalendarMonthId;

	    SELECT * from @error;

        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM Pay.CalculationResult cr
            INNER JOIN cfg.ManualReceipt AS ps
                ON ps.CalculationResultID = cr.CalculationResultID
            INNER JOIN pay.CalculationPersonel cv
                ON cv.CalculationPersonelID = cr.CalculationPersonelID
            INNER JOIN #personel
                ON #personel.VALUE = cv.PersonelID
        WHERE cv.CalculationTypeID = @CalcTypeId
              AND cv.CalendarMonthID = @CalendarMonthId
    )
    BEGIN
        SET @message = N'PayrollManager.Messages.InformationIsUsedInManualRetrieval';
    
	    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
	    SELECT * from @error;
	    RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM Pay.CalculationResult cr
            INNER JOIN cfg.DebitCreditNoteItem AS ps
                ON ps.CalculationResultID = cr.CalculationResultID
            INNER JOIN pay.CalculationPersonel cv
                ON cv.CalculationPersonelID = cr.CalculationPersonelID
            INNER JOIN #personel
                ON #personel.VALUE = cv.PersonelID
        WHERE cv.CalculationTypeID = @CalcTypeId
              AND cv.CalendarMonthID = @CalendarMonthId
    )
    BEGIN
        SET @message = N'PayrollManager.Messages.InformationIsUsedInDebitCreditNote';

	    INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
	    SELECT * from @error;
	    RETURN;
    END;

    DELETE Pay.CalculationPersonel
    FROM Pay.CalculationPersonel cp
        INNER JOIN #personel
            ON #personel.VALUE = cp.PersonelID
    WHERE cp.CalculationTypeID = @CalcTypeId
          AND cp.CalendarMonthID = @CalendarMonthId;
      
    SELECT * from @error;
END;
