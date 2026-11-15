
CREATE   PROC [ATN].spAttendaceCalculationControls

(
    @CalendarMonthID INT,
    @SelectedPersonel NVARCHAR(MAX),
    @Type TINYINT,
    @CalcDate DATE = Null,
    @CalcType TINYINT = 1 --1 FinalCalc    2 TemporaryCalc
)

AS

--	@Type = 1		ForCalculation  
--	@Type = 2			ForDelete 
--	@Type = 3			ForSendingToPayroll    
--	@Type = 4		ForReturnFromPayroll

DECLARE @ErrorMessage NVARCHAR(MAX),
@StartDate DATE,
@CalendarMonthEndDate DATE

SELECT VALUE PersonelID
INTO   #Personel
FROM   CFG.R_FnCommaStr2Table(@SelectedPersonel)
    
     
SELECT @StartDate = cm.AttendanceStartDate,@CalendarMonthEndDate = cm.AttendanceEndDate
FROM hrm.CalendarMonth AS cm 
WHERE cm.CalendarMonthID = @CalendarMonthID

-- Check If For Final Calculation Selected Date is End of Month
begin
if @CalcType = 1 and @CalcDate <> @CalendarMonthEndDate
  BEGIN
 
  	SET @ErrorMessage = 
        N' برای محاسبات نهایی باید تاریخ محاسبه برابر تاریخ پایان ماه باشد.'
    
    RAISERROR (@ErrorMessage, 16, 10)
    RETURN
  END
END
 --- Control 1
  ------- check if at least one person has been calculated in payroll
  -- For all operations this Control will be executed   
  
    
 IF @Type = 3 OR @Type = 4
 BEGIN
 
IF EXISTS (
       SELECT 1
       FROM   pay.CalculationPersonel  AS cp
       join pay.CalculationType AS ct on ct.CalculationTypeID = cp.CalculationTypeID
              JOIN #Personel           AS p
                   ON  cp.PersonelID = p.PersonelID
       WHERE  cp.CalendarMonthID = @CalendarMonthID
       and ct.PayTimeType = 0
       
   )
BEGIN
    SET @ErrorMessage = 
        N' در ماه انتخاب شده برای برخی از افراد انتخاب شده  محاسبه وجود دارد و امکان ادامه عملیات وجود ندارد.'
    
    RAISERROR (@ErrorMessage, 16, 10)
    RETURN
END

 END
    
 --- Control 2
 --- Check if data has been sent to Payroll
 
IF @Type = 1
   OR @Type = 2
   OR @Type = 3
   BEGIN
   	
  
    IF EXISTS (
           SELECT 1
           FROM   ATN.AttendanceCalculationPersonnel AS acp1
           JOIN #Personel AS p ON acp1.PersonelID = p.PersonelID
           WHERE  acp1.[Status] = 2
                  AND acp1.CalendarMonthID = @CalendarMonthID
       )
    BEGIN
        SET @ErrorMessage = 
            N' در ماه انتخاب شده برای برخی از افراد انتخاب شده  اطلاعات ارسال شده است و امکان ادامه عملیات وجود ندارد.'
        
        RAISERROR (@ErrorMessage, 16, 10)
        RETURN
    END
     END
    
 --- Control 3
 --- Check if data has been sent to Payroll
 
IF @Type = 1
   BEGIN
   	
           
   	IF EXISTS (
           SELECT 1
           FROM   ATN.AttendanceCalculationPersonnel AS acp1
           JOIN #Personel AS p ON acp1.PersonelID = p.PersonelID
           WHERE   acp1.CalendarMonthID = @CalendarMonthID
       )
    BEGIN
        SET @ErrorMessage = 
            N' در ماه انتخاب شده برای برخی از افراد انتخاب شده  محاسبه انجام شده است،  امکان ادامه عملیات وجود ندارد.'
        
        RAISERROR (@ErrorMessage, 16, 10)
        RETURN
    END  
    
   END
    
    
    --Check if there is some mission request that has not been confirmed
    IF @Type = 1
    BEGIN
    	IF EXISTS (SELECT 1 FROM atn.LeaveRequest AS lr
    	JOIN #Personel AS p ON lr.PersonelID = p.PersonelID
    	           WHERE lr.EndDate BETWEEN @StartDate AND @CalcDate
    	           AND lr.[Status] = 1)
    	           BEGIN
    	           	
    	              SET @ErrorMessage = 
            N' تا پایان ماه انتخاب شده، درخواست مرخصی‌های وجود دارد که رد یا تایید نشده اند.'
        
        RAISERROR (@ErrorMessage, 16, 10)
        RETURN
        
  END
    END
        --Check if there is Temporary Calculation
    IF @Type = 3
    BEGIN
    	IF EXISTS (SELECT 1 FROM atn.AttendanceCalculationPersonnel acp1
    	JOIN #Personel AS p ON acp1.PersonelID = p.PersonelID
    	           WHERE  acp1.CalendarMonthID = @CalendarMonthID
    	           and acp1.[Status] = 3 )
    	           BEGIN
    	           	
    	              SET @ErrorMessage = 
            N' برای برخی از ردیفهای انتخاب شده، محاسبات نهایی انجام نشده است.'
        
        RAISERROR (@ErrorMessage, 16, 10)
        RETURN
        
  END
    END
