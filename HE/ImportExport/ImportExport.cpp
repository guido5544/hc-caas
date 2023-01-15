/***********************************************************************************************************************
*
* Copyright (c) 2022 by Tech Soft 3D, LLC.
* The information contained herein is confidential and proprietary to Tech Soft 3D, LLC., and considered a trade secret
* as defined under civil and criminal statutes. Tech Soft 3D shall pursue its civil and criminal remedies in the event
* of unauthorized use or misappropriation of its trade secrets. Use of this information by anyone other than authorized
* employees of Tech Soft 3D, LLC. is granted only under a written non-disclosure agreement, expressly prescribing the
* scope and manner of such use.
*
***********************************************************************************************************************/

/*
* This sample demonstrates how to load a model and export it as a model file of a different format. The chosen
* format is determined by the file extension of the output file name.
*/

#include <atlstr.h>

#define INITIALIZE_A3D_API
#include <A3DSDKIncludes.h>

#include "common.hpp"

static MY_CHAR acSrcFileName[_MAX_PATH * 2];
static MY_CHAR acDstFileName[_MAX_PATH * 2];
static MY_CHAR aFormat[_MAX_PATH * 2];
static MY_CHAR aLicense[10000];
static MY_CHAR dllPath[10000];

A3DRWParamsLoadData m_sLoadData;
A3DRWParamsExportGltfData		m_sExportGltfData;
A3DRWParamsExportFbxData		m_sExportFbxData;
A3DEModellerType m_eFormat = kA3DModellerGltf;

A3DAsmModelFile* m_psModelFile;

A3DStatus LoadSDK(const TCHAR* pcLibraryPath, const A3DUTF8Char* license)
{
	A3DStatus iRet;
	if (!A3DSDKLoadLibrary(pcLibraryPath))
		return A3D_ERROR;


	A3DLicPutUnifiedLicense(license);

	A3DInt32 iMajorVersion = 0, iMinorVersion = 0;
	iRet = A3DDllGetVersion(&iMajorVersion, &iMinorVersion);
	if (iRet != A3D_SUCCESS)
		return iRet;

	iRet = A3DDllInitialize(A3D_DLL_MAJORVERSION, A3D_DLL_MINORVERSION);
	return iRet;
}



void initImport()
{
	A3D_INITIALIZE_DATA(A3DRWParamsLoadData, m_sLoadData);
	m_sLoadData.m_sGeneral.m_bReadSolids = true;
	m_sLoadData.m_sGeneral.m_bReadSurfaces = true;
	m_sLoadData.m_sGeneral.m_bReadWireframes = true;
	m_sLoadData.m_sGeneral.m_bReadPmis = true;
	m_sLoadData.m_sGeneral.m_bReadAttributes = true;
	m_sLoadData.m_sGeneral.m_bReadHiddenObjects = true;
	m_sLoadData.m_sGeneral.m_bReadConstructionAndReferences = false;
	m_sLoadData.m_sGeneral.m_bReadActiveFilter = true;
	m_sLoadData.m_sGeneral.m_eReadingMode2D3D = kA3DRead_3D;
	m_sLoadData.m_sGeneral.m_eReadGeomTessMode = kA3DReadGeomAndTess;
	m_sLoadData.m_sGeneral.m_eDefaultUnit = kA3DUnitUnknown;
	m_sLoadData.m_sTessellation.m_eTessellationLevelOfDetail = kA3DTessLODMedium;
	m_sLoadData.m_sAssembly.m_bUseRootDirectory = true;
	m_sLoadData.m_sMultiEntries.m_bLoadDefault = true;
	m_sLoadData.m_sPmi.m_bAlwaysSubstituteFont = false;
	m_sLoadData.m_sPmi.m_pcSubstitutionFont = (char*) "Myriad CAD";
}



void InitExport()
{
	A3D_INITIALIZE_DATA(A3DRWParamsExportGltfData, m_sExportGltfData);
	A3D_INITIALIZE_DATA(A3DRWParamsExportFbxData, m_sExportFbxData);
}



A3DStatus Import(const A3DUTF8Char* filename)
{

	A3DStatus iRet = A3DAsmModelFileLoadFromFile(filename, &m_sLoadData, &m_psModelFile);
	return iRet;
}

CStringA ConvertUnicodeToUTF8(const CStringW& uni)
{
	if (uni.IsEmpty()) return ""; // nothing to do
	CStringA utf8;
	int cc = 0;
	// get length (cc) of the new multibyte string excluding the \0 terminator first
	if ((cc = WideCharToMultiByte(CP_UTF8, 0, uni, -1, NULL, 0, 0, 0) - 1) > 0)
	{
		// convert
		char *buf = utf8.GetBuffer(cc);
		if (buf) WideCharToMultiByte(CP_UTF8, 0, uni, -1, buf, cc, 0, 0);
		utf8.ReleaseBuffer();
	}
	return utf8;
}

A3DStatus Export(const A3DUTF8Char* filename)
{
	A3DStatus iRet;

	if (wcscmp(aFormat, L"FBX") != 0) {
		iRet = A3DAsmModelFileExportToGltfFile(m_psModelFile, &m_sExportGltfData, filename);
	}
	else
	{
		iRet = A3DAsmModelFileExportToFbxFile(m_psModelFile, &m_sExportFbxData, filename);

	}
	return iRet;
}
//######################################################################################################################
#ifdef _MSC_VER
int wmain(A3DInt32 iArgc, A3DUniChar** ppcArgv)
#else
int main(A3DInt32 iArgc, A3DUTF8Char** ppcArgv)
#endif
{
	//
	// ### COMMAND LINE ARGUMENTS
	//

	if (iArgc < 2)
	{
		MY_PRINTF2("Usage:\n %s [input CAD file] [output CAD file] [output LOG file]\n", ppcArgv[0]);
		MY_PRINTF("  Default output CAD file is [input CAD file].prc\n");
		MY_PRINTF("  Default output LOG file is [output CAD file]_Log.txt\n\n");
		return A3D_ERROR;
	}

	MY_STRCPY(acSrcFileName, ppcArgv[1]);
	MY_STRCPY(acDstFileName, ppcArgv[2]);
	MY_STRCPY(aFormat, ppcArgv[3]);

	MY_STRCPY(aLicense, ppcArgv[4]);
	MY_STRCPY(dllPath, ppcArgv[5]);

	//
	// ### INITIALIZE HOOPS EXCHANGE
	//

	CStringA licenseu8 = ConvertUnicodeToUTF8(aLicense);

	LoadSDK(dllPath, licenseu8);

	initImport();
	InitExport();
	m_sLoadData.m_sTessellation.m_eTessellationLevelOfDetail = (A3DETessellationLevelOfDetail)0;

	A3DUTF8Char acFileNameUTF8[_MAX_PATH];
	A3DMiscUTF16ToUTF8(acSrcFileName, acFileNameUTF8);

	Import(acFileNameUTF8);

	A3DMiscUTF16ToUTF8(acDstFileName, acFileNameUTF8);

	Export(acFileNameUTF8);

	return 0;


	//A3DSDKHOOPSExchangeLoader sHoopsExchangeLoader(_T(HOOPS_BINARY_DIRECTORY));
	//CHECK_RET(sHoopsExchangeLoader.m_eSDKStatus);

	//CHECK_RET(A3DDllSetCallbacksMemory(CheckMalloc, CheckFree));
	//CHECK_RET(A3DDllSetCallbacksReport(PrintLogMessage, PrintLogWarning, PrintLogError));

	////
	//// ### PROCESS SAMPLE CODE
	////

	//// specify input file
	//A3DImport sImport(acSrcFileName); // see A3DSDKInternalConvert.hxx for import and export detailed parameters
	//
	//								  // specify output file
	//A3DExport sExport(acDstFileName); // see A3DSDKInternalConvert.hxx for import and export detailed parameters
	//sImport.m_sLoadData.m_sTessellation.m_eTessellationLevelOfDetail = (A3DETessellationLevelOfDetail)0;
	//								  // perform conversion
	//CHECK_RET(sHoopsExchangeLoader.Convert(sImport, sExport));

	////
	//// ### TERMINATE HOOPS EXCHANGE
	////

	//// Check memory allocations
	//return (int)ListLeaks();
}
