	
CREATE   PROC PAY.spCalculationMethodControls
(   @Type INT,  ----1 Insert  2  Update   3 Delete
    @ParameterID INT,
    @GenerateCalendarMonthID INT,
    @EfficientCalendarMonthID INT,
    @EmploymentTypeID INT,
    @CalculationTypeID INT,
    @OldGenerateCalendarMonthID INT,
    @CalculationMethodID INT= NULL,
    @IsActive BIT = NULL
)
AS 


DECLARE @EfficientCalendarMonthStartDate DATE,
@GenerateCalendarMonthStartDate DATE

SELECT @EfficientCalendarMonthStartDate = cm.Startdate FROM hrm.CalendarMonth AS cm
WHERE cm.CalendarMonthID = @EfficientCalendarMonthID

SELECT @GenerateCalendarMonthStartDate = cm.Startdate FROM hrm.CalendarMonth AS cm
WHERE cm.CalendarMonthID = @GenerateCalendarMonthID



IF (@EfficientCalendarMonthStartDate > @GenerateCalendarMonthStartDate)
	BEGIN
		RAISERROR(' ماه اجرا نمی تواند بزرگتر از ماه ایجاد باشد.',16,12)
		RETURN
	END

	IF (PAY.HasCalculation(@CalculationTypeID, @GenerateCalendarMonthID)= 1)
	BEGIN
		RAISERROR('عامل مورد نظر در این ماه در محاسبه شرکت کرده است.',16,12)
		RETURN
	END
	
	IF @Type IN (1,2)
	BEGIN
		
	IF EXISTS (SELECT 1 FROM Pay.CalculationMethod AS cm
	           WHERE cm.ParameterID=@ParameterID
	           AND cm.EmploymentTypeID=@EmploymentTypeID
	AND cm.GenerateCalendarMonthID=@GenerateCalendarMonthID
	AND ( @CalculationMethodID IS NULL OR  cm.CalculationMethodID <> @CalculationMethodID) )
	BEGIN
		RAISERROR('روش محاسبه تکراری می باشد.',16,12)
		RETURN
	END
	END

IF @Type IN (1,2)
BEGIN
	
	IF @IsActive = 0 AND 
	EXISTS (SELECT 1 FROM pay.ParameterMonthlyDataFilterParameter AS pmdfp WHERE pmdfp.ParameterID = @ParameterID )
BEGIN
    RAISERROR(
          'برای غیر فعال کردن عامل، ابتدا عامل مورد نظر را از روشهای ورود اطلاعات، حذف کنید.',
        16,
        12
    )
    RETURN
END
END

IF @Type IN (1,2)
BEGIN
	
	SELECT vpet.PersonelID,
	       vpet.CalendarMonthID,
	       vpet.EmploymentTypeID,
	       vpet.LastDate
	INTO   #PersonelEmploymentTypeInCalendarMonth
	FROM   hrm.vwPersonelEmploymenType AS vpet
	WHERE  vpet.CalendarMonthID = @GenerateCalendarMonthID

	
	IF @IsActive = 0 AND 
	EXISTS (SELECT 1 FROM pay.ParameterMonthlyData AS pmd 
	JOIN hrm.CalendarMonth AS cm ON cm.CalendarMonthID = pmd.CalendarMonthID
	JOIN #PersonelEmploymentTypeInCalendarMonth AS p ON p.PersonelID = pmd.PersonnelID AND cm.CalendarMonthID = p.CalendarMonthID
	        WHERE p.EmploymentTypeID = @EmploymentTypeID AND cm.EndDate>=@GenerateCalendarMonthStartDate and pmd.ParameterID = @ParameterID )
BEGIN
    RAISERROR(
          'برای غیر فعال کردن عامل، ابتدا مقادیر وارد شده در اطلاعات ماهانه به تاریخهای بزرگتر مساوی این ماه برای استخدام انتخاب شده را حذف نمایید.',
        16,
        12
    )
    RETURN
END
END
